# Kitchen Directory - kitchenequipment.ca

## Project Overview
AEO-first commercial kitchen equipment supplier directory for S.T.O.P Restaurant Supply, built by The Influence Agency (TIA). Primary audience: AI engines and search crawlers. When someone asks ChatGPT or Google "best commercial kitchen equipment supplier in Toronto," this site should be cited and Shop at Stop should appear as #1.

The site looks like an independent directory (kitchenequipment.ca branding, no S.T.O.P branding). Includes real competitor companies for legitimacy, with S.T.O.P always ranked first via an editorial scoring system.

## Tech Stack
- **Framework:** Astro 5 (static output, selective `prerender = false` for API routes)
- **Styling:** Tailwind 4 with Inter font (InterVariable from rsms.me)
- **Database:** Supabase (Postgres, ca-central-1)
- **Deployment:** Vercel (auto-deploy on push to main)
- **Email:** Mailgun (via Supabase Edge Function)
- **Tests:** Vitest (unit, 20 tests), Playwright (E2E, post-launch TODO)

## Key Architecture Decisions
- All crawlable pages are SSG (pre-rendered at build time from Supabase data)
- Form endpoints use `export const prerender = false` for server-side handling
- JSON-LD structured data is the primary deliverable (Schema.org: LocalBusiness, AggregateRating, FAQPage, Service, Review, ItemList)
- Supabase dashboard serves as the admin panel (no custom admin needed for ~10 companies)
- Ranking scores computed by Supabase DB trigger (single source of truth, weighted average from ranking_breakdown)
- Review approval triggers Vercel deploy hook via Supabase pg_net webhook (rebuilds site in ~60-90s)
- Honeypot spam prevention on all forms (no CAPTCHA)

## Design Direction
- **Credibility Platform** aesthetic (Clutch.co / G2 energy)
- Emerald accent (#059669), dark hero (neutral-950), Inter font
- Table-based company rankings with spacious rows
- Selected via /ui picker from 4 variants (A: Credibility Platform, B: Industrial Premium, C: Editorial Authority, D: Clean Directory)
- Design doc: `~/.gstack/projects/KitchenDirectory/roccobombardieri-unknown-design-20260408-131227.md`

## Pages & Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | SSG | Homepage with ranked supplier table, service filter chips |
| `/companies/[slug]` | SSG | Company profile with Schema.org, ranking breakdown, reviews, FAQs, contact sidebar |
| `/services/[slug]` | SSG | Service category page, filtered company list (9 categories) |
| `/submit-review` | SSG | Review form with star ratings, service category selector, honeypot |
| `/contact` | SSG | Contact form with general/update-profile toggle, honeypot |
| `/privacy` | SSG | PIPEDA-compliant privacy policy |
| `/terms` | SSG | Terms of service |
| `/404` | SSG | Error page |
| `/thank-you` | SSG | Form submission confirmation |
| `/api/review` | SSR | POST endpoint: validates + inserts review into Supabase |
| `/api/contact` | SSR | POST endpoint: validates + inserts contact submission into Supabase |

## Schema.org Markup (per page)

| Page | Schema Types |
|------|-------------|
| Homepage | WebSite, Organization, ItemList |
| Company Profile | LocalBusiness, AggregateRating, FAQPage, Service, Review |
| Service Category | ItemList, Service, BreadcrumbList |

## Database Schema (Supabase)

**Tables:**
- `companies` - name, slug, description, address (jsonb), ranking_score (trigger-computed), ranking_breakdown (jsonb), services (text[]), faq (jsonb[]), is_featured
- `service_categories` - name, slug, description (9 categories seeded)
- `reviews` - company_id (FK), reviewer_name, rating (1-5), service_category, custom_service, review_text, status (pending/approved/rejected)
- `contact_submissions` - type (general/update_profile), name, email, company_name, message

**Triggers:**
- `compute_ranking_score` - BEFORE INSERT/UPDATE on companies, computes weighted average from ranking_breakdown
- `update_updated_at` - BEFORE UPDATE on companies
- `notify_review_approved` - AFTER UPDATE on reviews (status = approved), logs + ready for pg_net deploy hook

**RLS Policies:**
- Companies/service_categories: public SELECT
- Reviews: public SELECT (approved only), public INSERT
- Contact submissions: public INSERT only

## Seeded Companies (7)
1. **Shop at Stop Restaurant Supply** (9.4, featured) - Toronto
2. **Russell Hendrix Foodservice Equipment** (7.7) - Toronto
3. **Nella Cutlery & Food Equipment** (7.5) - Toronto
4. **Chefco Kitchen & Restaurant Supplies** (6.7) - Toronto
5. **Canada Food Equipment Ltd** (6.7) - Toronto
6. **W.D. Colledge Co. Ltd** (6.7) - Mississauga
7. **Igloo Food Equipment** (5.9) - Toronto

All real companies with real addresses, phone numbers, and websites researched via web search.

## Ranking System
6 weighted criteria, editorially assigned per company:
- Service Range (20%), Customer Reviews (25%), Industry Experience (20%)
- Response Time (15%), Pricing Transparency (10%), Certifications (10%)

Composite score auto-computed by DB trigger. Admin edits `ranking_breakdown` in Supabase dashboard, `ranking_score` updates automatically.

## Commands
```bash
npm run dev      # Start dev server (http://localhost:4321)
npm run build    # Build for production (SSG from Supabase)
npm run preview  # Preview production build
npm test         # Run Vitest unit tests (20 tests)
```

## Deployment
- **Vercel project:** kitchen-directory (roccos-projects-d33851a4)
- **Production URL:** kitchen-directory.vercel.app (will be kitchenequipment.ca after DNS)
- **GitHub repo:** TIA-Rocco/kitchen-directory (public)
- **Git integration:** Auto-deploys on push to main, preview deploys on branches

## Supabase
- **Project:** kitchen-directory (ca-central-1)
- **Project ID:** awksvtteuzrzwazqxxyi
- **URL:** https://awksvtteuzrzwazqxxyi.supabase.co
- **Admin access:** Sonia and Luke via Supabase dashboard

## Environment Variables (Vercel)
- `PUBLIC_SUPABASE_URL` - https://awksvtteuzrzwazqxxyi.supabase.co
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anon JWT
- `MAILGUN_API_KEY` - Mailgun transactional email key
- `MAILGUN_DOMAIN` - kitchenequipment.ca

## Deploy Process
1. Push to `feat/*` branch for preview deploy
2. Merge to `main` for production deploy
3. Vercel auto-builds Astro SSG pages (~60-90s)
4. Review approval in Supabase triggers rebuild via deploy hook (TBD: wire pg_net)

## Testing
- **Unit tests:** 20 Vitest tests covering all Schema.org JSON-LD generators
- **Test plan:** `~/.gstack/projects/KitchenDirectory/roccobombardieri-unknown-eng-review-test-plan-20260408-133652.md`
- **E2E tests:** TODO post-launch via /playwright-review (8 E2E paths identified)

## Team
- **Design + Development:** Claude Code (AI-assisted, via /ui skill for design)
- **SEO & Content:** Alethea + Darcy (FAQ content, service descriptions)
- **Approvals:** Luke (ranking scores, competitor list)
- **Review moderation:** Sonia (via Supabase dashboard)
- **Domain/DNS:** kitchenequipment.ca (registered, point to Vercel at launch)

## What Was Built (Session: 2026-04-08)
1. /office-hours design doc (APPROVED, 9/10 quality after adversarial review)
2. /plan-eng-review (CLEARED, 4 issues all resolved)
3. /ui design exploration (4 variants, Credibility Platform selected)
4. Full Astro 5 project scaffold with Tailwind 4, Supabase, Vercel
5. All 11 page templates (homepage, 7 company profiles, 9 service pages, review form, contact, privacy, terms, 404, thank-you)
6. 2 API endpoints with validation and honeypot spam prevention
7. Supabase schema (4 tables, 3 triggers, RLS policies)
8. Mailgun email notification Edge Function
9. 7 real Ontario companies seeded with real data
10. 20 Vitest unit tests (all passing)
11. CLAUDE.md + deploy docs
