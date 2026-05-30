-- 012_service_card_blurb.sql
-- Adds a short summary for the homepage "Browse by service" grid.
--
-- The long-form `description` stays the AEO body copy on /services/[slug]
-- (and feeds that page's intro paragraph). `card_blurb` is the condensed
-- ~3-4 line version shown only on the homepage cards. The homepage falls back
-- to `description` when `card_blurb` is null, so this is forward-compatible.

alter table public.service_categories
  add column if not exists card_blurb text;
