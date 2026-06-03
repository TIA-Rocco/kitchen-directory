-- ============================================================================
-- 015_review_pipeline.sql
-- ----------------------------------------------------------------------------
-- Bring the review-moderation flow to parity with the supplier-submission
-- pipeline (ADMIN side only). Reviews now get a proper queue: status-filter
-- tabs, a per-review detail page, auto-saved moderator notes, a rejection
-- reason captured to those notes, and a reopen (rejected -> pending) recovery
-- path -- instead of inline approve/reject with no audit trail.
--
-- Deliberately NO status-enum change: reviews stay pending/approved/rejected.
-- There is no `needs_info` / applicant-email step because a review is an
-- anonymous public testimonial with no reply channel (unlike a company
-- application, which has a business email). Audit cols (approved_by/at,
-- rejected_by/at) already exist from 006.
--
-- This migration adds two columns:
--   * internal_notes  -> moderator notes + stamped rejection reasons
--   * updated_at      -> last-touched timestamp. NOTE: this also un-breaks the
--     admin dashboard's "recent activity" query, which already SELECTs and
--     ORDERs reviews by updated_at -- a column that did not exist until now, so
--     that query was silently erroring and review activity never appeared.
--
-- Forward-only, idempotent.
-- ============================================================================

alter table reviews
  add column if not exists internal_notes text,
  add column if not exists updated_at timestamptz not null default now();

-- Reuse update_updated_at() (defined in 001) so any moderation write
-- (approve / reject / reopen / notes) bumps updated_at.
drop trigger if exists trg_reviews_updated_at on reviews;
create trigger trg_reviews_updated_at
  before update on reviews
  for each row execute function update_updated_at();

-- ----------------------------------------------------------------------------
-- Re-establish the approve -> rebuild trigger.
--   notify_review_approved() (created in 002, hardened to SECURITY DEFINER in
--   007) fires the Vercel deploy hook when a review flips to 'approved'. But the
--   TRIGGER that invokes it was dropped from this table at some point: a live
--   inventory shows only trg_new_review_admin_notify + the updated_at trigger
--   remain. Net effect on prod today: approving a review did NOT rebuild the
--   public site, so a freshly-approved review never appeared on the company
--   profile until an unrelated deploy. Recreate it so the moderation queue
--   actually publishes (matches the supplier-submission approve -> deploy flow).
--
-- The function's internal guard (old.status <> 'approved') keeps notes/other
-- updates on an already-approved row from re-firing the hook.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_review_approved on reviews;
create trigger trg_review_approved
  after update of status on reviews
  for each row
  when (new.status = 'approved')
  execute function notify_review_approved();
