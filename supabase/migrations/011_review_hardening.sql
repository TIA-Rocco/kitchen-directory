-- ============================================================================
-- 011_review_hardening.sql
-- ----------------------------------------------------------------------------
-- Codex final-review P2 fixes:
--
-- (1) Soft-deleted companies were still readable via the public Data API: the
--     companies SELECT policy was `using (true)`. Restrict it to
--     `deleted_at is null` so archived companies are invisible to the anon key
--     everywhere (Data API AND the SSG build, which uses the anon client).
--     Admin paths use the service-role client (BYPASSRLS) and still see all.
--
-- (2) Duplicate-company race: app-level duplicate detection in list-company.ts
--     can't stop two concurrent identical submissions from both being approved
--     into separate companies. A partial unique index on the active company
--     name makes the second insert fail (approve surfaces an error) instead of
--     silently creating a duplicate.
-- Forward-only.
-- ============================================================================

drop policy if exists "Companies are publicly readable" on companies;
create policy "Companies are publicly readable"
  on companies for select
  using (deleted_at is null);

create unique index if not exists companies_unique_active_name
  on companies (lower(name)) where deleted_at is null;
