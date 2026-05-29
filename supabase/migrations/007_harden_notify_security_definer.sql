-- ============================================================================
-- 007_harden_notify_security_definer.sql
-- ----------------------------------------------------------------------------
-- FIX (P1): Public review submissions return 500 ("Failed to submit review").
--
-- Root cause (verified on prod): the AFTER INSERT trigger
-- notify_new_review_to_admins() is SECURITY INVOKER, so on a public review
-- insert it runs as `anon`. It calls _admin_emails_array()/_site_url(), which
-- SELECT from vault.decrypted_secrets. `anon` has no SELECT on that view, so
-- the read raises "permission denied", which is UNCAUGHT (it happens before
-- send_transactional_email's own handler), aborting the transaction and rolling
-- back the insert. Introduced ~May 26 (005); only the pre-trigger Apr 30 review
-- survives.
--
-- Fix: make every vault-reading helper AND every notify trigger function
-- SECURITY DEFINER (owner = postgres, which CAN read vault + run net.http_post),
-- pin a safe search_path on each, schema-qualify all refs, wrap each trigger
-- body so a notification failure can NEVER roll back a citizen write, and
-- REVOKE direct EXECUTE from anon/authenticated/public (defense in depth — these
-- must not be callable directly by untrusted roles).
--
-- Forward-only. Does not touch the duplicate 005/006 history.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vault-reading helpers -> SECURITY DEFINER + pinned search_path
-- ---------------------------------------------------------------------------
create or replace function public._admin_emails_array()
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  raw text;
begin
  select decrypted_secret into raw
    from vault.decrypted_secrets where name = 'admin_emails' limit 1;
  if raw is null or raw = '' then
    return '{}'::text[];
  end if;
  return string_to_array(lower(replace(raw, ' ', '')), ',');
end;
$$;

create or replace function public._site_url()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  s text;
begin
  select decrypted_secret into s
    from vault.decrypted_secrets where name = 'site_url' limit 1;
  return coalesce(s, 'https://kitchen-directory.vercel.app');
end;
$$;

create or replace function public.send_transactional_email(
  p_template text,
  p_to text[],
  p_vars jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  edge_url text;
  edge_secret text;
  body jsonb;
  headers jsonb;
begin
  select decrypted_secret into edge_url
    from vault.decrypted_secrets where name = 'mailgun_edge_url' limit 1;
  if edge_url is null or edge_url = '' then
    return;  -- vault not configured -> no-op
  end if;

  select decrypted_secret into edge_secret
    from vault.decrypted_secrets where name = 'edge_shared_secret' limit 1;

  body := jsonb_build_object(
    'template', p_template,
    'to', to_jsonb(p_to),
    'vars', coalesce(p_vars, '{}'::jsonb)
  );
  headers := '{"Content-Type": "application/json"}'::jsonb;
  if edge_secret is not null and edge_secret <> '' then
    headers := headers || jsonb_build_object('x-edge-secret', edge_secret);
  end if;

  perform net.http_post(url := edge_url, headers := headers, body := body);
exception
  when others then
    raise notice 'send_transactional_email(%) failed: %', p_template, sqlerrm;
end;
$$;

create or replace function public.fire_deploy_hook()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  hook_url text;
begin
  select decrypted_secret into hook_url
    from vault.decrypted_secrets where name = 'vercel_deploy_hook' limit 1;
  if hook_url is null or hook_url = '' then
    return;
  end if;
  perform net.http_post(
    url := hook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
exception
  when others then
    raise notice 'fire_deploy_hook failed: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notify trigger functions -> SECURITY DEFINER + pinned search_path +
-- defensive exception handler (a notify failure must never roll back the
-- underlying INSERT/UPDATE).
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_review_to_admins()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  admins text[];
  site text;
  cname text;
begin
  admins := public._admin_emails_array();
  site := public._site_url();
  if array_length(admins, 1) is null then
    return new;
  end if;
  select name into cname from public.companies where id = new.company_id;
  perform public.send_transactional_email(
    'admin_new_review',
    admins,
    jsonb_build_object(
      'company_name', coalesce(cname, 'Unknown company'),
      'rating', new.rating::text,
      'review_id', new.id::text,
      'admin_url', site || '/admin/reviews/' || new.id::text
    )
  );
  return new;
exception
  when others then
    raise notice 'notify_new_review_to_admins failed: %', sqlerrm;
    return new;
end;
$$;

create or replace function public.notify_new_pending_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  admins text[];
  site text;
begin
  if new.status = 'pending' and (old.status is distinct from 'pending') then
    admins := public._admin_emails_array();
    site := public._site_url();
    if array_length(admins, 1) is not null then
      perform public.send_transactional_email(
        'admin_new_submission',
        admins,
        jsonb_build_object(
          'company_name', new.name,
          'submission_id', new.id::text,
          'admin_url', site || '/admin/submissions/' || new.id::text
        )
      );
    end if;
  end if;
  return new;
exception
  when others then
    raise notice 'notify_new_pending_submission failed: %', sqlerrm;
    return new;
end;
$$;

create or replace function public.notify_supplier_approved()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  site text;
  company_slug text;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    site := public._site_url();
    company_slug := null;
    if new.promoted_company_id is not null then
      select slug into company_slug from public.companies where id = new.promoted_company_id;
    end if;
    perform public.send_transactional_email(
      'approved',
      array[new.business_email],
      jsonb_build_object(
        'company_name', new.name,
        'company_url', site || '/companies/' || coalesce(company_slug, '')
      )
    );
    perform public.fire_deploy_hook();
  end if;
  return new;
exception
  when others then
    raise notice 'notify_supplier_approved failed: %', sqlerrm;
    return new;
end;
$$;

create or replace function public.notify_review_approved()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    perform public.fire_deploy_hook();
  end if;
  return new;
exception
  when others then
    raise notice 'notify_review_approved failed: %', sqlerrm;
    return new;
end;
$$;

create or replace function public.notify_ranking_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
begin
  if new.ranking_breakdown is distinct from old.ranking_breakdown then
    perform public.fire_deploy_hook();
  end if;
  return new;
exception
  when others then
    raise notice 'notify_ranking_changed failed: %', sqlerrm;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down direct EXECUTE. Trigger functions fire via the trigger mechanism
-- (no EXECUTE check) and the notify functions call the helpers as the definer
-- (postgres), so untrusted roles never need direct EXECUTE on any of these.
-- ---------------------------------------------------------------------------
revoke execute on function public._admin_emails_array()                              from public, anon, authenticated;
revoke execute on function public._site_url()                                        from public, anon, authenticated;
revoke execute on function public.send_transactional_email(text, text[], jsonb)      from public, anon, authenticated;
revoke execute on function public.fire_deploy_hook()                                 from public, anon, authenticated;
revoke execute on function public.notify_new_review_to_admins()                      from public, anon, authenticated;
revoke execute on function public.notify_new_pending_submission()                    from public, anon, authenticated;
revoke execute on function public.notify_supplier_approved()                         from public, anon, authenticated;
revoke execute on function public.notify_review_approved()                           from public, anon, authenticated;
revoke execute on function public.notify_ranking_changed()                           from public, anon, authenticated;
