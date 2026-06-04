-- 016_google_ratings.sql
-- ---------------------------------------------------------------------------
-- Google reviews: store each company's real Google Business Profile rating as
-- an ATTRIBUTED third-party snapshot (display-only). These columns NEVER feed
-- the page's own AggregateRating JSON-LD (that stays first-party / approved
-- reviews only, via src/lib/schema.ts -> buildAggregateRatingSchema). Showing
-- Google's number as our own structured rating risks a deceptive-markup manual
-- action that could strip rich results domain-wide. See the build spec:
--   ~/.gstack/projects/KitchenDirectory/google-reviews-build-spec-20260604.md
--
-- Provenance / ToS posture:
--   * google_place_id is the one field Google's terms allow storing long-term.
--   * The aggregate rating is kept as a DATED snapshot (google_rating_as_of),
--     which is far more defensible than continuously caching live data.
--
-- All five columns are additive + nullable and public-readable (the existing
-- companies SELECT RLS policy is row-level "deleted_at is null" and exposes all
-- columns, so no policy change is required). Companies with no Google Business
-- Profile rating simply leave these null and the UI omits the badge.
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists google_place_id    text,
  add column if not exists google_rating      numeric(2,1),
  add column if not exists google_review_count integer,
  add column if not exists google_rating_as_of date,
  add column if not exists google_place_url    text;

comment on column public.companies.google_place_id is
  'Google Places place_id for this company''s primary GBP location (the one field Google ToS permits storing indefinitely).';
comment on column public.companies.google_rating is
  'Attributed Google star rating (0.0-5.0), display-only. NEVER emit as the site''s own AggregateRating schema.';
comment on column public.companies.google_review_count is
  'Google review count at the snapshot date (display-only).';
comment on column public.companies.google_rating_as_of is
  'Date the Google rating snapshot was pulled; surfaced in the UI as "as of <Mon YYYY>".';
comment on column public.companies.google_place_url is
  'Link target for the required "View on Google" attribution.';

-- No new trigger: the existing trg_company_changed already fires the Vercel
-- deploy hook on any company update, so a one-shot backfill rebuilds the SSG
-- site once. (The backfill seed disables that trigger during its bulk UPDATE
-- and lets the merge/deploy rebuild a single time.)
