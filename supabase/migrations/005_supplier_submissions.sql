-- ============================================================================
-- 005_supplier_submissions.sql
-- ----------------------------------------------------------------------------
-- Supplier self-submission funnel:
--   * supplier_submissions table (unverified -> pending -> approved/rejected)
--   * verification + auto-purge helpers
--   * promote_submission() to materialize a verified submission into companies
--   * pg_net triggers to notify admins, send applicant emails, and fire the
--     Vercel deploy hook on approvals + ranking changes.
--
-- All pg_net calls are guarded by a `vault.decrypted_secrets` lookup so a
-- fresh project without secrets configured can still run this migration
-- end-to-end without errors. This migration is re-runnable (idempotent
-- where possible).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- Enum: submission_status
-- ----------------------------------------------------------------------------
do $$
begin
  create type submission_status as enum
    ('unverified', 'pending', 'approved', 'rejected', 'needs_info');
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Table: supplier_submissions
-- ----------------------------------------------------------------------------
create table if not exists supplier_submissions (
  id uuid primary key default uuid_generate_v4(),

  -- profile (mirrors companies)
  name text not null,
  website_url text not null,
  phone text not null,
  business_email text not null,
  address jsonb not null default '{}'::jsonb, -- { street, city, province, postal }
  services text[] not null default '{}',
  years_in_business integer,
  certifications text[] not null default '{}',
  description text not null,
  faq jsonb not null default '[]'::jsonb,    -- [{ question, answer }]
  logo_url text,

  -- submitter
  submitted_by_name text not null,
  submitted_by_email text not null,
  submitter_ip text,

  -- workflow
  status submission_status not null default 'unverified',
  verification_token uuid,
  verified_at timestamptz,
  internal_notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  promoted_company_id uuid references companies(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_submissions_status
  on supplier_submissions (status, created_at desc);

create index if not exists idx_supplier_submissions_token
  on supplier_submissions (verification_token)
  where verification_token is not null;

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses update_updated_at() from 001)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_supplier_submissions_updated_at on supplier_submissions;
create trigger trg_supplier_submissions_updated_at
  before update on supplier_submissions
  for each row execute function update_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table supplier_submissions enable row level security;

drop policy if exists "Anyone can submit"          on supplier_submissions;
drop policy if exists "Authenticated users can read"   on supplier_submissions;
drop policy if exists "Authenticated users can update" on supplier_submissions;

create policy "Anyone can submit"
  on supplier_submissions for insert
  with check (true);

create policy "Authenticated users can read"
  on supplier_submissions for select
  to authenticated
  using (true);

create policy "Authenticated users can update"
  on supplier_submissions for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- Slug generation helper
-- ============================================================================
create or replace function generate_unique_company_slug(base_name text)
returns text as $$
declare
  base_slug text;
  candidate text;
  suffix int := 2;
begin
  -- lowercase, replace non-alnum with dashes, collapse runs of dashes, trim
  base_slug := lower(coalesce(base_name, ''));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');

  if base_slug = '' then
    base_slug := 'company';
  end if;

  candidate := base_slug;
  while exists (select 1 from companies where slug = candidate) loop
    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  end loop;

  return candidate;
end;
$$ language plpgsql;

-- ============================================================================
-- promote_submission(submission_id) -> uuid
-- ----------------------------------------------------------------------------
-- Atomically materializes a pending submission into the companies table.
-- Caller is responsible for flipping status to 'approved' + audit cols
-- (so RLS + admin user id come from the API layer).
-- ============================================================================
create or replace function promote_submission(submission_id uuid)
returns uuid as $$
declare
  sub supplier_submissions%rowtype;
  new_company_id uuid;
  new_slug text;
begin
  select * into sub from supplier_submissions where id = submission_id for update;

  if not found then
    raise exception 'Submission % not found', submission_id;
  end if;

  if sub.status <> 'pending' then
    raise exception 'Submission % is not pending (status: %)', submission_id, sub.status;
  end if;

  new_slug := generate_unique_company_slug(sub.name);

  insert into companies (
    name, slug, description, logo_url, website_url, phone, email,
    address, services, faq, is_featured, ranking_breakdown
  ) values (
    sub.name,
    new_slug,
    sub.description,
    sub.logo_url,
    sub.website_url,
    sub.phone,
    sub.business_email,
    sub.address,
    sub.services,
    sub.faq,
    false,
    '{
      "service_range": 0,
      "customer_reviews": 0,
      "industry_experience": 0,
      "response_time": 0,
      "pricing_transparency": 0,
      "certifications": 0
    }'::jsonb
  ) returning id into new_company_id;

  update supplier_submissions
    set promoted_company_id = new_company_id
    where id = submission_id;

  return new_company_id;
end;
$$ language plpgsql;

-- ============================================================================
-- Auto-purge stale unverified submissions
-- ============================================================================
create or replace function purge_unverified_submissions()
returns integer as $$
declare
  deleted_count integer;
begin
  with deleted as (
    delete from supplier_submissions
    where status = 'unverified'
      and created_at < now() - interval '48 hours'
    returning 1
  )
  select count(*) into deleted_count from deleted;

  return coalesce(deleted_count, 0);
end;
$$ language plpgsql;

-- Schedule hourly via pg_cron when available; silently no-op otherwise.
do $$
begin
  perform cron.schedule(
    'purge-unverified-supplier-submissions',
    '0 * * * *',
    $cron$ select purge_unverified_submissions(); $cron$
  );
exception
  when others then
    -- pg_cron not installed or already scheduled — fine for dev.
    null;
end $$;

-- ============================================================================
-- pg_net helpers
-- ----------------------------------------------------------------------------
-- All helpers below read from vault.decrypted_secrets. If the required secret
-- is missing, the call short-circuits to a no-op so dev doesn't blow up.
-- Vault secret names (set via Supabase dashboard → Project Settings → Vault):
--   * mailgun_edge_url     -> https://<proj-ref>.functions.supabase.co/send-transactional-email
--   * edge_shared_secret   -> matches EDGE_SHARED_SECRET on Edge Function
--   * admin_emails         -> comma-separated lowercased admin emails
--   * site_url             -> e.g. https://kitchenequipment.ca
--   * vercel_deploy_hook   -> Vercel deploy hook URL
-- ============================================================================

create or replace function fire_deploy_hook()
returns void as $$
declare
  hook_url text;
begin
  select decrypted_secret into hook_url
    from vault.decrypted_secrets
    where name = 'vercel_deploy_hook'
    limit 1;

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
$$ language plpgsql;

create or replace function send_transactional_email(
  p_template text,
  p_to text[],
  p_vars jsonb
)
returns void as $$
declare
  edge_url text;
  edge_secret text;
  body jsonb;
  headers jsonb;
begin
  select decrypted_secret into edge_url
    from vault.decrypted_secrets where name = 'mailgun_edge_url' limit 1;

  if edge_url is null or edge_url = '' then
    -- Vault not configured — skip silently so migrations + dev still work.
    return;
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

  perform net.http_post(
    url := edge_url,
    headers := headers,
    body := body
  );
exception
  when others then
    raise notice 'send_transactional_email(%) failed: %', p_template, sqlerrm;
end;
$$ language plpgsql;

create or replace function _admin_emails_array()
returns text[] as $$
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
$$ language plpgsql;

create or replace function _site_url()
returns text as $$
declare
  s text;
begin
  select decrypted_secret into s
    from vault.decrypted_secrets where name = 'site_url' limit 1;
  return coalesce(s, 'https://kitchen-directory.vercel.app');
end;
$$ language plpgsql;

-- ============================================================================
-- Trigger: notify admins when a submission becomes "pending" (verified)
-- ============================================================================
create or replace function notify_new_pending_submission()
returns trigger as $$
declare
  admins text[];
  site text;
begin
  if new.status = 'pending' and (old.status is distinct from 'pending') then
    admins := _admin_emails_array();
    site := _site_url();

    if array_length(admins, 1) is not null then
      perform send_transactional_email(
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
end;
$$ language plpgsql;

drop trigger if exists trg_new_pending_submission on supplier_submissions;
create trigger trg_new_pending_submission
  after update of status on supplier_submissions
  for each row execute function notify_new_pending_submission();

-- ============================================================================
-- Trigger: notify supplier + rebuild site on approval
-- ============================================================================
create or replace function notify_supplier_approved()
returns trigger as $$
declare
  site text;
  company_slug text;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    site := _site_url();
    company_slug := null;

    if new.promoted_company_id is not null then
      select slug into company_slug from companies where id = new.promoted_company_id;
    end if;

    perform send_transactional_email(
      'approved',
      array[new.business_email],
      jsonb_build_object(
        'company_name', new.name,
        'company_url', site || '/companies/' || coalesce(company_slug, '')
      )
    );

    perform fire_deploy_hook();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_supplier_approved on supplier_submissions;
create trigger trg_supplier_approved
  after update of status on supplier_submissions
  for each row execute function notify_supplier_approved();

-- ============================================================================
-- Trigger: notify admins when a new review lands
-- ============================================================================
create or replace function notify_new_review_to_admins()
returns trigger as $$
declare
  admins text[];
  site text;
  cname text;
begin
  admins := _admin_emails_array();
  site := _site_url();

  if array_length(admins, 1) is null then
    return new;
  end if;

  select name into cname from companies where id = new.company_id;

  perform send_transactional_email(
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
end;
$$ language plpgsql;

drop trigger if exists trg_new_review_admin_notify on reviews;
create trigger trg_new_review_admin_notify
  after insert on reviews
  for each row execute function notify_new_review_to_admins();

-- ============================================================================
-- Replace notify_review_approved() (from 002) to actually fire the deploy hook
-- ============================================================================
create or replace function notify_review_approved()
returns trigger as $$
begin
  if new.status = 'approved' and (old.status is null or old.status != 'approved') then
    raise notice 'Review % approved for company %', new.id, new.company_id;
    perform fire_deploy_hook();
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Trigger: rebuild site when ranking_breakdown changes
-- ============================================================================
create or replace function notify_ranking_changed()
returns trigger as $$
begin
  if new.ranking_breakdown is distinct from old.ranking_breakdown then
    perform fire_deploy_hook();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_company_ranking_changed on companies;
create trigger trg_company_ranking_changed
  after update of ranking_breakdown on companies
  for each row execute function notify_ranking_changed();
