-- ============================================================================
-- 008_submission_pipeline.sql
-- ----------------------------------------------------------------------------
-- Demote the email-verification gate (decision: a hand-curated directory where
-- an editor approves every company doesn't need a blocking email step that can
-- silently strand submissions). And fix the approve flow's data-integrity hole.
--
--  * New submissions are auto-verified -> 'pending' (column default), so they
--    appear in the admin queue immediately. The verification link becomes
--    optional confirmation, never a gate.
--  * approve_submission(): ATOMIC + IDEMPOTENT replacement for the old
--    "promote_submission then separately set status" two-step, which could
--    create a DUPLICATE company if the API crashed/retried between the two
--    writes (Codex P1). Now one function creates the company (only if not
--    already promoted), flips status, and writes audit cols in a single
--    transaction; re-approving a row returns the existing company.
--    Accepts unverified/pending/needs_info (kills the needs_info dead-end).
--  * notify_submission_inserted(): admins are notified when a submission lands
--    as 'pending' on INSERT (the old notify only fired on UPDATE -> pending).
--
-- Forward-only.
-- ============================================================================

-- Auto-verify: new submissions default to 'pending'.
alter table supplier_submissions alter column status set default 'pending';

-- ---------------------------------------------------------------------------
-- Atomic + idempotent approval.
-- ---------------------------------------------------------------------------
create or replace function public.approve_submission(
  p_submission_id uuid,
  p_admin_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  sub public.supplier_submissions%rowtype;
  new_company_id uuid;
  new_slug text;
begin
  select * into sub from public.supplier_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission % not found', p_submission_id using errcode = 'no_data_found';
  end if;

  -- Idempotent: already approved + materialized -> return the existing company.
  if sub.status = 'approved' and sub.promoted_company_id is not null then
    return sub.promoted_company_id;
  end if;

  if sub.status = 'rejected' then
    raise exception 'Submission % was rejected; reopen it before approving', p_submission_id
      using errcode = 'check_violation';
  end if;

  -- Accept unverified / pending / needs_info. Reuse an already-created company
  -- if a prior partial run set promoted_company_id (no duplicate).
  new_company_id := sub.promoted_company_id;
  if new_company_id is null then
    new_slug := public.generate_unique_company_slug(sub.name);
    insert into public.companies (
      name, slug, description, logo_url, website_url, phone, email,
      address, services, faq, is_featured, ranking_breakdown
    ) values (
      sub.name, new_slug, sub.description, sub.logo_url, sub.website_url,
      sub.phone, sub.business_email, sub.address, sub.services, sub.faq, false,
      '{"service_range":0,"customer_reviews":0,"industry_experience":0,"response_time":0,"pricing_transparency":0,"certifications":0}'::jsonb
    ) returning id into new_company_id;
  end if;

  update public.supplier_submissions
    set status = 'approved',
        promoted_company_id = new_company_id,
        approved_by = p_admin_id,
        approved_at = now()
    where id = p_submission_id;

  return new_company_id;
end;
$$;

revoke execute on function public.approve_submission(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.approve_submission(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Notify admins when a submission is INSERTed already-pending (auto-verify).
-- Complements notify_new_pending_submission (which fires on UPDATE -> pending,
-- e.g. a manual verify or a clicked link).
-- ---------------------------------------------------------------------------
create or replace function public.notify_submission_inserted()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  admins text[];
  site text;
begin
  if new.status = 'pending' then
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
    raise notice 'notify_submission_inserted failed: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_submission_inserted on supplier_submissions;
create trigger trg_submission_inserted
  after insert on supplier_submissions
  for each row execute function public.notify_submission_inserted();

revoke execute on function public.notify_submission_inserted() from public, anon, authenticated;

-- NOTE: the 48h purge_unverified_submissions job is NOT scheduled (pg_cron is
-- not installed on this project), so stuck rows are not auto-deleted. With
-- auto-verify, near-zero rows will sit in 'unverified' anyway. Left as-is.
