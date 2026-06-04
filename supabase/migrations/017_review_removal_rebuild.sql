-- ============================================================================
-- 017_review_removal_rebuild.sql
-- ----------------------------------------------------------------------------
-- Admins can now REMOVE a review from the admin panel (hard delete) to purge
-- spam / test reviews. The approve -> rebuild path already exists
-- (trg_review_approved, 015). This migration adds the INVERSE: a review
-- LEAVING the 'approved' state -- by being deleted, or by a status change away
-- from approved -- fires the same Vercel deploy hook, so the public SSG profile
-- and its AggregateRating drop the review on the next rebuild instead of
-- lingering until an unrelated deploy.
--
-- Only an APPROVED review's removal triggers a rebuild: pending/rejected
-- reviews are not on the public site, so deleting that junk causes no
-- needless build.
--
-- Forward-only, idempotent. Additive: one SECURITY DEFINER function + two
-- triggers. No schema / column changes. Mirrors the hardened notify pattern
-- from 007 (pinned search_path, defensive handler, EXECUTE revoked).
-- ============================================================================

create or replace function public.notify_review_unpublished()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
begin
  if tg_op = 'DELETE' then
    -- A live (approved) review was deleted -> take it off the public site.
    if old.status = 'approved' then
      perform public.fire_deploy_hook();
    end if;
    return old;
  else
    -- An approved review moved to a non-approved state (e.g. rejected) -> same.
    if old.status = 'approved' and new.status is distinct from 'approved' then
      perform public.fire_deploy_hook();
    end if;
    return new;
  end if;
exception
  -- A notify failure must never roll back the underlying DELETE/UPDATE.
  when others then
    raise notice 'notify_review_unpublished failed: %', sqlerrm;
    if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke execute on function public.notify_review_unpublished() from public, anon, authenticated;

-- Hard delete of an approved (live) review -> rebuild.
drop trigger if exists trg_review_deleted on reviews;
create trigger trg_review_deleted
  after delete on reviews
  for each row
  when (old.status = 'approved')
  execute function notify_review_unpublished();

-- Approved review un-published via status change (approved -> rejected/pending)
-- -> rebuild. (trg_review_approved handles the forward approved direction.)
drop trigger if exists trg_review_unpublished on reviews;
create trigger trg_review_unpublished
  after update of status on reviews
  for each row
  when (old.status = 'approved' and new.status is distinct from 'approved')
  execute function notify_review_unpublished();
