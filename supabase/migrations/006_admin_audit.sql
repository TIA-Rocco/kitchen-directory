-- ============================================================================
-- 006_admin_audit.sql
-- ----------------------------------------------------------------------------
-- Adds audit columns to `reviews` so the admin UI can record who approved or
-- rejected each review and when. Mirrors the audit cols already on
-- supplier_submissions (added in 005).
--
-- Idempotent: re-runnable via `add column if not exists`.
-- ============================================================================

alter table reviews
  add column if not exists approved_by  uuid references auth.users(id),
  add column if not exists approved_at  timestamptz,
  add column if not exists rejected_by  uuid references auth.users(id),
  add column if not exists rejected_at  timestamptz;
