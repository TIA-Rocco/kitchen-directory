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
- `PUBLIC_SITE_URL` - https://kitchen-directory.vercel.app (origin used to build admin magic-link callbacks; update at DNS cutover to https://kitchenequipment.ca)
- `MAILGUN_API_KEY` - Mailgun transactional email key
- `MAILGUN_DOMAIN` - kitchenequipment.ca
- `ADMIN_EMAILS` - comma-separated allow-list for admin magic-link sign-in

## Admin Auth (magic link)
- `/admin/login` posts to `/api/admin/login` which calls `supabase.auth.signInWithOtp({ shouldCreateUser: false, options: { emailRedirectTo } })`. The callback is built from `PUBLIC_SITE_URL` (falling back to `url.origin`) → `/admin/auth/callback?next=…`.
- Admins must be **pre-provisioned** in `auth.users` via the Supabase Admin API (`shouldCreateUser:false`). Emails not in `ADMIN_EMAILS` are silently no-op'd to avoid enumeration / email-bombing.
- **Supabase Auth → URL Configuration** must include every callback host in the **Redirect URLs** allow-list. If `emailRedirectTo` isn't allow-listed, Supabase silently rewrites the link to the **Site URL** and the PKCE `code` arrives at `/` with nothing to exchange it. Current entries:
  - `https://kitchen-directory.vercel.app/admin/auth/callback`
  - `https://kitchen-directory.vercel.app/**`
  - `http://localhost:4321/admin/auth/callback`
- Site URL is `https://kitchen-directory.vercel.app`. Update at DNS cutover.
- Email send rate limit is configured under Auth → Rate Limits. The default shared SMTP (`mail.app.supabase.io`) is dev-only and caps around 2/hr — for production use, plug **Mailgun SMTP** into Auth → SMTP Settings (creds under Mailgun → Sending → Domain settings → SMTP credentials, not the API key).
- `PUBLIC_SITE_URL` is inlined by Astro at build time — after changing it in Vercel, **redeploy** before the new value takes effect.

## Deploy Process
1. Push to `feat/*` branch for preview deploy
2. Merge to `main` for production deploy
3. Vercel auto-builds Astro SSG pages (~60-90s)
4. Review approval (and other admin approval flows) updates the row → DB trigger calls `fire_deploy_hook()` → pg_net POSTs to the Vercel deploy hook (URL stored in Supabase Vault as `vercel_deploy_hook`) → Vercel rebuilds SSG in ~60-90s.

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

## What Was Built (Session: 2026-04-30, branch RoccoBMB/partners-blog)
1. **Brand Partners** on company profiles
   - Migration `003_partners.sql`: `partners` JSONB column on `companies` (`[{name, logo_url?, url?}]`)
   - Section on `/companies/[slug]` between Services Offered and Customer Reviews (conditional on partners.length > 0)
   - LocalBusiness JSON-LD extended with `brand` array
   - Seeded Shop at Stop with Vitamix, Hobart, Robot Coupe partners
2. **Blog system** (Supabase-authored, markdown rendered)
   - Migration `004_blog.sql`: `blog_posts` table (title, slug, body, excerpt, featured_image_url, author, category, linked_companies[], meta_title, meta_description, status, published_at) + RLS + deploy-hook trigger
   - `/blog` index page (SSG, lists published posts) with Blog JSON-LD
   - `/blog/[slug]` post page (SSG, getStaticPaths) with sanitized markdown body, "Featured Suppliers" sidebar from linked_companies, BlogPosting JSON-LD
   - `src/lib/markdown.ts` — `marked` + `isomorphic-dompurify` for safe rendering
   - "Blog" link added to top-nav across all 7 pages
3. **Rating Breakdown tooltip**
   - New `src/components/InfoTooltip.astro` (first component) — accessible, keyboard-friendly, hover (desktop) + tap-to-toggle (mobile), Escape to close
   - Integrated next to "Rating Breakdown" heading on company profile, lists 6 criteria + weights
4. **Tests**: 19 new tests (39 total, all passing) — schema builders + markdown sanitization
5. **Forum**: explicitly dropped, revisit Q4 2026

### Migrations to apply
After pulling: apply `supabase/migrations/003_partners.sql` and `004_blog.sql` to the live Supabase project (via Supabase MCP, `supabase db push`, or paste into Dashboard SQL editor).

## What Was Built (Session: 2026-05-29, branch feat/remaining-dev-tasks)
"Remaining dev tasks" — fixed the two client-reported bugs, demoted the submission verification gate, built company management + a landing redesign, and published blog/category content. Migrations 007-011 were applied directly to prod via Supabase MCP.

1. **Review-submit 500 — root-caused + fixed (migration 007).** The `AFTER INSERT` trigger `notify_new_review_to_admins()` was `SECURITY INVOKER`, so on a public (anon) review it read `vault.decrypted_secrets`, which `anon` can't SELECT → uncaught permission-denied → insert rolled back. Fix: all vault-reading helpers + notify trigger functions are now `SECURITY DEFINER` with pinned `search_path`, schema-qualified, wrapped in defensive handlers, and `EXECUTE` revoked from anon/authenticated/public. Verified: anon insert now succeeds on prod.
2. **Submission pipeline (migration 008).** Demoted the email-verification gate: new submissions auto-verify to `pending` (a human approves every company, so the blocking email was a silent single point of failure). `approve_submission()` is an atomic, idempotent replacement for the old promote-then-update two-step that could create duplicate companies on retry. Admin UI: Submissions list has status-filter tabs + surfaces `unverified`; detail page approves unverified/needs_info, has a Reopen action, captures a reject/needs-info reason. `list-company.ts`: auto-verify + duplicate detection + disposable-email block. "Best Equipment Co." (Dmitry's stuck test) rescued to `pending`.
3. **Company management (migrations 009, 011).** Full profile editor (all fields except slug — immutable), soft-delete (`deleted_at`, type-name confirm, reversible), manual "New company", via a shared `CompanyForm.astro`. Public SSG queries filter `deleted_at is null`, and the companies SELECT RLS policy is `deleted_at is null` so archived companies vanish from the Data API + build. A trigger fires the Vercel deploy hook on any company insert/update/delete. Partial unique index on `lower(name)` (active) guards the dup race.
4. **Landing redesign (migration 010) — Option A.** `/` rebuilt (refero research: Fiverr + Wrike + Eventbrite): split dark hero, 9-category grid (emerald icon tiles), condensed Top-Rated suppliers list + dark CTA band. `WebSite`+`Organization`+`ItemList` JSON-LD preserved on `/` (AEO #1-citation signal). Shared `Header.astro` + `ServiceIcon.astro`. `/services/[slug]` gains a description + FAQ accordion + `FAQPage` JSON-LD; `service_categories.faq` jsonb added.
5. **Content.** 8 net-new buyer-guide blog posts (9 total) + 9 category descriptions/FAQs, authored by a parallel agent swarm, grounded in real supplier data, no fabricated stats, zero em-dashes. Applied to prod (`scripts/build-content-seed.cjs` + `supabase/seed/blog_and_category_content.sql`). Darcy reviews the live articles after.

### Verification
- Full `astro build` renders `/` + 9 services + 9 blog posts + 7 companies + sitemap.
- Codex final review: no P1; P2s fixed (RLS Data-API leak, open-redirect guard in admin callback, dup-company index).
- **Shipped + canary-verified live** on kitchen-directory.vercel.app (landing, blog with images, per-category FAQ pages, company admin, both bug fixes). Migrations 007-011 applied to prod.

### Known / follow-ups
- **Blog featured images** done: real Unsplash photos (Unsplash License, free to use) downloaded + self-hosted at `/public/blog/<slug>.jpg` (1600x900), assigned via `supabase/seed/blog_featured_images.sql`. All 9 posts have live images. Swap for client/brand photography later by replacing the files or updating `featured_image_url`.
- **Mailgun edge-function secret** still unset (email delivery) — non-blocking now that submissions auto-verify; set it via the TIA team Vercel/Supabase scope to enable notification emails. Reject/needs-info applicant emails are still mailto (server-side templates pending edge config).
- **P3 (accepted):** approval fires two deploy hooks (company insert + status update) — harmless extra rebuild.
- 17 stale branches are all merged-by-patch (`git cherry`) and safe to delete; duplicate 005/006 migration numbers are latent (left as-is, forward-only 007-011 added).

## What Was Built (Session: 2026-06-01, branch fix/security-prelaunch)
Pre-launch black-box + source **security audit** (`/security-audit`) and the launch-blocking fixes. Full report + owner message + fix prompts in `.context/kitchen-directory.vercel.app-*` (gitignored).

**Findings (verified against live prod): 1 Critical, 2 High, plus mediums/lows.** The app's front-door auth (admin middleware `getUser()` + `ADMIN_EMAILS`, email Edge Function `EDGE_SHARED_SECRET`, server-only service-role key) is solid; the gaps were all in **direct PostgREST access** that bypasses the app.

Applied:
1. **SEC-03 (High) — stored XSS via JSON-LD.** `Base.astro` emitted `set:html={JSON.stringify(schema)}`; `JSON.stringify` doesn't escape `<`/`>`/`&`, so a review body / FAQ answer with `</script>` could break out and execute. New `src/lib/jsonld.ts` `safeJsonLd()` escapes `<`,`>`,`&`,U+2028,U+2029 (valid round-trip JSON). 6 unit tests. **Deploys with this branch.**
2. **Migration `013_security_prelaunch_rls.sql` (applied to prod via MCP + verified):**
   - SEC-02 (High): `reviews` INSERT `with check (true)` → `(status='pending')` — kills anon self-publishing of `approved` reviews (moderation + AggregateRating bypass).
   - SEC-06 (Med): `supplier_submissions` INSERT → constrained to the `unverified` entry state — blocks bypassing Turnstile/rate-limit/validation via direct REST.
   - SEC-01 (Critical, layer 2): `supplier_submissions` SELECT/UPDATE re-scoped from the whole `authenticated` role to allow-listed admins via new `public.is_admin()` (SECURITY DEFINER, reads Vault `admin_emails`; EXECUTE revoked from anon/public, granted to authenticated). Verified: admin sees rows, non-admin sees 0, anon blocked.

**STILL REQUIRED before launch (could not be done via code/MCP):**
- 🔴 **SEC-01 primary fix — disable public signup.** Supabase **Auth → Providers → Email → uncheck "Allow new users to sign up"** (`disable_signup:true`). Project-level signup is currently OPEN, which is what let any internet user mint an `authenticated` session and (pre-013) read all supplier PII. The 013 RLS scoping is the second layer; this toggle is the primary fix.

**Out of scope / documented but not fixed (Low/hardening, see report):** 6 `function_search_path_mutable`, `pg_net` in public schema, GraphQL anon/authenticated table *metadata* exposure (row data is RLS-protected — verified), missing security headers (recommend `vercel.json` CSP etc.), no rate-limit/CAPTCHA on `/api/review` + `/api/contact` (admin email-bomb vector once Mailgun is configured). `contact_submissions` INSERT stays `with check(true)` by design (public form, insert-only, no readable PII). SEC-07 (open redirect) was already fixed in #16/#17.
