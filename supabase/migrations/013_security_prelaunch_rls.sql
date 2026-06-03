-- ============================================================================
-- 013_security_prelaunch_rls.sql
-- ----------------------------------------------------------------------------
-- Pre-launch security audit (2026-06-01) — close over-permissive RLS that is
-- reachable directly via PostgREST with the public anon/authenticated keys,
-- bypassing the Astro app's ADMIN_EMAILS middleware gate.
--
-- Findings addressed:
--   SEC-02 (High):   reviews INSERT used WITH CHECK (true) -> anyone could
--                    insert a row pre-set to status='approved', skipping
--                    moderation. Constrain public inserts to status='pending'.
--   SEC-06 (Medium): supplier_submissions INSERT used WITH CHECK (true) ->
--                    direct REST inserts bypassed Turnstile/rate-limit/validation
--                    in list-company.ts and could set any status. Constrain
--                    public inserts to the funnel's true entry state.
--   SEC-01 (Critical, defence-in-depth): supplier_submissions granted SELECT +
--                    UPDATE to the whole `authenticated` role. With open signup,
--                    any registered user could read applicant PII and tamper with
--                    submissions. Scope both to allow-listed admins via is_admin().
--                    NOTE: the PRIMARY fix for SEC-01 is disabling public signup
--                    (Supabase Auth -> Providers -> Email -> "Allow new users to
--                    sign up" = OFF / disable_signup:true). This migration is the
--                    second layer.
--
-- Forward-only. Idempotent (drop policy if exists + create or replace).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SEC-02: reviews — public can only insert PENDING reviews.
-- status defaults to 'pending', so the real /api/review form (never sends
-- status) is unaffected; a forged status='approved'/'rejected' is rejected.
-- ----------------------------------------------------------------------------
drop policy if exists "Anyone can submit a review" on public.reviews;
create policy "Anyone can submit a pending review"
  on public.reviews
  for insert
  with check (status = 'pending');

-- ----------------------------------------------------------------------------
-- SEC-06: supplier_submissions — public can only insert UNVERIFIED rows with no
-- workflow/audit fields pre-set. The funnel (list-company.ts) inserts with the
-- service-role client (BYPASSRLS), so it is unaffected.
-- ----------------------------------------------------------------------------
drop policy if exists "Anyone can submit" on public.supplier_submissions;
create policy "Anyone can submit unverified"
  on public.supplier_submissions
  for insert
  with check (
    status = 'unverified'
    and verified_at is null
    and approved_by is null
    and rejected_by is null
    and promoted_company_id is null
  );

-- ----------------------------------------------------------------------------
-- SEC-01 (defence-in-depth): restrict supplier_submissions reads/updates to
-- allow-listed admins instead of every authenticated account.
--
-- is_admin() reads the same Vault 'admin_emails' secret already used by
-- _admin_emails_array() (migration 005) and compares it to the caller's JWT
-- email claim. SECURITY DEFINER so it can read Vault; pinned search_path;
-- EXECUTE granted only to authenticated (mirrors the 007 hardening pattern).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = any(
    select unnest(
      string_to_array(
        lower(replace(coalesce(decrypted_secret, ''), ' ', '')),
        ','
      )
    )
    from vault.decrypted_secrets
    where name = 'admin_emails'
    limit 1
  );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;  -- anon never evaluates it (policies are `to authenticated`)
grant execute on function public.is_admin() to authenticated;

alter table public.supplier_submissions enable row level security;

drop policy if exists "Authenticated users can read"   on public.supplier_submissions;
drop policy if exists "Authenticated users can update" on public.supplier_submissions;

create policy "Admins can read submissions"
  on public.supplier_submissions
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update submissions"
  on public.supplier_submissions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- POST-APPLY VERIFICATION (run manually; do not leave in the migration):
--
--   -- 1. SEC-01 must still let a real admin read submissions. Simulate:
--   --    (replace with a real admin email present in the Vault 'admin_emails')
--   select set_config(
--     'request.jwt.claims',
--     json_build_object('email','<admin@example.com>','role','authenticated')::text,
--     true);
--   set local role authenticated;
--   select count(*) from public.supplier_submissions;   -- expect: all rows
--   reset role;
--   -- A non-admin email in the same simulation must return 0 rows.
--
--   -- 2. SEC-02 / SEC-06 (black-box, anon key):
--   --   POST /rest/v1/reviews {"...","status":"approved"}              -> 403
--   --   POST /rest/v1/reviews {"..."}  (no status)                     -> 201 (pending)
--   --   POST /rest/v1/supplier_submissions {"...","status":"pending"}  -> 403
-- ============================================================================
