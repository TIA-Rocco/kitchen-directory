-- ============================================================================
-- 014_company_certifications_and_service_name_fix.sql
-- ----------------------------------------------------------------------------
-- Two data-integrity fixes for the supplier self-submission -> approval flow:
--
--  1. CERTIFICATIONS were collected on the apply form and stored on
--     supplier_submissions.certifications, but silently dropped at approval:
--     companies had no certifications column and approve_submission() never
--     copied them. Add the column (public-readable, same exposure as services)
--     and carry the array through on approval.
--
--  2. SERVICE SLUG vs DISPLAY-NAME MISMATCH. The apply funnel stores service
--     *slugs* (e.g. 'restaurant-consulting'); the rest of the system keys off
--     *display names* (e.g. 'Restaurant Consulting') — companies.services, the
--     admin editor checkboxes, /services/[slug] filtering, and the review form
--     all use names. approve_submission() copied the slugs verbatim, so an
--     approved company's services matched no category page and showed as unchecked
--     in the admin editor ("services not stored"). Map slugs -> names on approval.
--
-- Forward-only. Idempotent where possible.
-- ============================================================================

-- 1. Certifications column on companies (public.companies SELECT is already
--    public via RLS, so this column is exposed on the Data API like services).
alter table public.companies
  add column if not exists certifications text[] not null default '{}';

-- 2. Rewrite approve_submission(): map service slugs -> display names and carry
--    certifications. Keeps the atomic + idempotent contract from migration 008.
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
  mapped_services text[];
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

  -- Map submission service slugs -> canonical display names (order preserved).
  -- Tolerant of values that are already display names; unknown values are dropped.
  select coalesce(array_agg(sc.name order by v.ord), '{}')
    into mapped_services
    from unnest(coalesce(sub.services, '{}'::text[])) with ordinality as v(val, ord)
    join public.service_categories sc
      on sc.slug = v.val or sc.name = v.val;

  -- Accept unverified / pending / needs_info. Reuse an already-created company
  -- if a prior partial run set promoted_company_id (no duplicate).
  new_company_id := sub.promoted_company_id;
  if new_company_id is null then
    new_slug := public.generate_unique_company_slug(sub.name);
    insert into public.companies (
      name, slug, description, logo_url, website_url, phone, email,
      address, services, certifications, faq, is_featured, ranking_breakdown
    ) values (
      sub.name, new_slug, sub.description, sub.logo_url, sub.website_url,
      sub.phone, sub.business_email, sub.address, mapped_services,
      coalesce(sub.certifications, '{}'::text[]), sub.faq, false,
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
