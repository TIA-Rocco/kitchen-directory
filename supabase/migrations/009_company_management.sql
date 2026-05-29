-- ============================================================================
-- 009_company_management.sql
-- ----------------------------------------------------------------------------
-- Foundation for admin company management (full edit / soft-delete / manual add).
--
--  * companies.deleted_at: soft-delete marker (null = active). Public SSG
--    queries filter on `deleted_at is null`; the row + its reviews + the
--    submission audit chain are preserved (reversible, no FK gymnastics).
--  * Rebuild the static site on ANY company insert/update/delete — not just
--    ranking changes — so profile edits, soft-deletes, and manual adds never
--    leave a stale or ghost page live for crawlers (the AEO mission).
--
-- Forward-only.
-- ============================================================================

alter table companies add column if not exists deleted_at timestamptz;

create or replace function public.notify_company_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
begin
  perform public.fire_deploy_hook();
  return null;  -- AFTER trigger
exception
  when others then
    raise notice 'notify_company_changed failed: %', sqlerrm;
    return null;
end;
$$;

-- Replace the ranking-only rebuild trigger with one covering all changes.
drop trigger if exists trg_company_ranking_changed on companies;
drop trigger if exists trg_company_changed on companies;
create trigger trg_company_changed
  after insert or update or delete on companies
  for each row execute function public.notify_company_changed();

revoke execute on function public.notify_company_changed() from public, anon, authenticated;
