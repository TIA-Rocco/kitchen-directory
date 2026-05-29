-- ============================================================================
-- 010_service_category_faq.sql
-- ----------------------------------------------------------------------------
-- Landing redesign: per-category FAQ content for /services/[slug] (FAQPage
-- JSON-LD + on-page accordion). Mirrors companies.faq exactly so the existing
-- FaqItem type + buildFAQPageSchema generator are reused as-is. Dashboard-
-- editable jsonb (array of { question, answer }).
-- Forward-only.
-- ============================================================================

alter table service_categories add column if not exists faq jsonb not null default '[]'::jsonb;
