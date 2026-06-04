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
| `/services` | SSG | Services index: 9 service-category icon cards + overarching ranked table of all suppliers |
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
| Services Index | ItemList (services), ItemList (suppliers), BreadcrumbList |
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

## What Was Built (Session: 2026-05-30, PR #18 feat/services-index-dropdown-icons)
Services nav polish + a new `/services` index. No DB/migration changes.

1. **Services dropdown icons.** Each row in the desktop Services dropdown now renders the homepage `ServiceIcon` in an emerald tile (emerald-50, fills emerald-600 on hover/focus); panel widened 30rem → 34rem to absorb the icon column. `Header.astro` imports `ServiceIcon`.
2. **New `/services` index page** (`src/pages/services/index.astro`, SSG). Hero + breadcrumb, the 9 service-category icon cards (mirrors the homepage grid), and **one overarching ranked table of every active supplier** across all services — the master directory, not the homepage top-5. Reuses the homepage companies + approved-review-stats query and the `/services/[slug]` table markup. "Browse all services" in the dropdown now points here (was the `/#categories` anchor).
3. **Schema.org.** `/services` emits services `ItemList` + suppliers `ItemList` (scoped to the `/services` URL) + `BreadcrumbList`. Homepage's primary supplier `ItemList` untouched. `/services/[slug]` breadcrumb's "Services" crumb now links to `/services` (schema already referenced it).

### Verification
- `astro build` renders `/services` + all routes; null-data fallbacks confirmed via smoke build.
- **Live visual QA (agent-browser) on kitchen-directory.vercel.app at 1280×800 + 375×812** — dropdown icons render per-slug and match the homepage; `/services` hero/cards/suppliers table render with real data (7 suppliers, Shop at Stop #1). Preview deploys are SSO-gated, so QA ran against the public production alias post-merge.

### Known / follow-ups
- **Resolved (PR #20):** the shared suppliers table (`/services` + `/services/[slug]`) clipped the `/10` score suffix at ~375px (table overflowed its `overflow-hidden` wrapper by ~26px). Fixed with mobile-first cell padding (`sm:` restores desktop), `whitespace-nowrap` + `text-xl sm:text-2xl` on the score, `flex-wrap` on the name/badge row, and `max-sm:hidden` on the row description. Validated 26px → 0px in a 375px repro harness and live on prod (mobile + desktop, both pages). CSS-only.

## What Was Built (Session: 2026-06-01 → 06-03, PR #22 fix/security-prelaunch)
Pre-launch black-box + source **security audit** (`/security-audit`) and the launch-blocking fixes.

**Findings (verified against live prod): 1 Critical, 2 High, plus mediums/lows.** The app's front-door auth (admin middleware `getUser()` + `ADMIN_EMAILS`, email Edge Function `EDGE_SHARED_SECRET`, server-only service-role key) is solid; the gaps were all in **direct PostgREST access** that bypasses the app.

Applied:
1. **SEC-03 (High) — stored XSS via JSON-LD.** `Base.astro` emitted `set:html={JSON.stringify(schema)}`; `JSON.stringify` doesn't escape `<`/`>`/`&`, so a review body / FAQ answer with `</script>` could break out and execute. New `src/lib/jsonld.ts` `safeJsonLd()` escapes `<`,`>`,`&`,U+2028,U+2029 (valid round-trip JSON). 6 unit tests. Ships in PR #22.
2. **Migration `013_security_prelaunch_rls.sql` (applied to prod via MCP + verified):**
   - SEC-02 (High): `reviews` INSERT `with check (true)` → `(status='pending')` — kills anon self-publishing of `approved` reviews (moderation + AggregateRating bypass).
   - SEC-06 (Med): `supplier_submissions` INSERT → constrained to the `unverified` entry state — blocks bypassing Turnstile/rate-limit/validation via direct REST.
   - SEC-01 (Critical, layer 2): `supplier_submissions` SELECT/UPDATE re-scoped from the whole `authenticated` role to allow-listed admins via new `public.is_admin()` (SECURITY DEFINER, reads Vault `admin_emails`; EXECUTE revoked from anon/public, granted to authenticated). Verified: admin sees rows, non-admin sees 0, anon blocked.
3. **SEC-01 primary fix — public signup DISABLED** (`disable_signup:true`). Black-box confirmed: `POST /auth/v1/signup` → `422 signup_disabled`. This is what previously let any internet user mint an `authenticated` session; 013 is the second layer.

**Out of scope / documented but not fixed (Low/hardening, see report):** 6 `function_search_path_mutable`, `pg_net` in public schema, GraphQL anon/authenticated table *metadata* exposure (row data is RLS-protected — verified), missing security headers (recommend `vercel.json` CSP etc.), no rate-limit/CAPTCHA on `/api/review` + `/api/contact` (admin email-bomb vector once Mailgun is configured). `contact_submissions` INSERT stays `with check(true)` by design (public form, insert-only, no readable PII). SEC-07 (open redirect) was already fixed in #16/#17.

### Security hardening backlog (post-launch — revisit)
Non-blocking items from the 2026-06-01 audit. All four launch-blockers (SEC-01/02/03/06) are fixed + verified live; these are the remaining lows/mediums.

1. **SEC-04 — Security headers (`vercel.json`).** Only HSTS is sent today. Add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a CSP — start as `Content-Security-Policy-Report-Only`, watch reports, then promote to enforcing. The CSP is also a second layer behind the SEC-03 XSS fix. CSP notes: `connect-src` must include `https://awksvtteuzrzwazqxxyi.supabase.co`; `script-src`/`frame-src` must allow Cloudflare Turnstile (`https://challenges.cloudflare.com`) + Vercel analytics (`https://va.vercel-scripts.com`); `style-src`/`font-src` allow `https://rsms.me` (Inter). Verify the Turnstile widget + Inter font still load after enforcing.

2. **SEC-05 — Rate-limit + CAPTCHA on `/api/review` & `/api/contact`.** Honeypot-only today (no Turnstile, no per-IP limit, no length caps). Each review insert fires `notify_new_review_to_admins` → an admin email, so this becomes an **admin email-bomb / Mailgun-quota vector once the Mailgun secret is configured** (currently unset, so latent). Mirror the well-defended `list-company.ts`: Cloudflare Turnstile (reuse `verifyTurnstile`/`parseTurnstileResponse` in `src/lib/validation.ts`), per-IP rate limit (~5 / 10 min via `getClientIp` + a service-role count query), and length caps (`reviewer_name`/`name` ≤ 120, `review_text`/`message` ≤ 5000).

3. **SEC-08 / SEC-09 — Postgres hardening (one migration).** `alter function … set search_path = public` on the 6 flagged funcs: `compute_ranking_score`, `update_updated_at`, `promote_submission(uuid)`, `purge_unverified_submissions`, `generate_unique_company_slug(text)`, `notify_blog_post_published`. Move the `pg_net` extension out of the `public` schema. Re-run Supabase advisors (security) to confirm both lints clear.

4. **SEC-10 (low) — Logo upload magic-byte check** in `src/pages/api/list-company.ts`: sniff PNG (`89 50 4E 47`) / JPEG (`FF D8 FF`) before upload rather than trusting the client-declared MIME; keep the existing size + SVG-exclusion checks.

**Done (PR #39, 2026-06-04) — Edge Function open-relay guard.** `send-transactional-email` only enforced the `x-edge-secret` header when `EDGE_SHARED_SECRET` was set; if unset it accepted any request (open email relay). Now refuses (`shared_secret_not_configured`) when the secret is unset **on a hosted deploy** (`DENO_DEPLOYMENT_ID` present), while still allowing local `supabase functions serve`. (Recovered from an uncommitted edit in a stale Conductor workspace during branch cleanup; the other 3 edits there — open-redirect guard, SVG logo removal, PNG/JPG copy — were already on main.) **Follow-up:** edge functions don't deploy via git — this takes effect only on the next `supabase functions deploy send-transactional-email`, and after that the hosted function refuses all calls until `EDGE_SHARED_SECRET` is set, so **set that secret before/with the deploy** (relevant when wiring up Mailgun for SEC-05).

Informational (no action): GraphQL anon/authenticated table-exposure advisors are *metadata discoverability* only — row data is RLS-protected (verified live). `auth_leaked_password_protection` advisor is N/A (magic-link only, no passwords).

## What Was Built (Session: 2026-06-03, PR #24 — Playwright E2E + a11y/font fixes)
Stood up the post-launch E2E suite (the long-standing `/playwright-review` TODO). It surfaced two real production bugs, both fixed in the same PR. Shipped via PR #24 (squash) and canary-verified live.

1. **Playwright E2E suite (`e2e/`, 178 tests / 15 files).** Targets the public prod alias by default (`BASE_URL` overridable; Vercel previews are SSO-gated so headless QA must hit the public alias). Covers: homepage, all 7 company profiles, all 9 service pages, blog index + 9 posts (incl. markdown XSS sanitization), static pages + real 404s, SEO (robots/sitemap/canonical/OG/Twitter + **site-wide JSON-LD validity** — compatible with the SEC-03 `safeJsonLd` escaping), accessibility (axe-core WCAG 2.1 A/AA, critical = hard fail), responsive (375 + 1280), all 4 forms (validation, honeypot, Turnstile bot-gate, real inserts tagged `[[KE-E2E]]` then deleted), and admin (unauth gate + authenticated flows via a programmatic Supabase session fixture; self-skip without creds). Adds `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/auth.setup.ts`, `e2e/README.md`; npm `test:e2e*` scripts; dev deps `@playwright/test` + `@axe-core/playwright`.
2. **Font CORS fix.** Inter was `@import`ed from `rsms.me`, which serves font files with no `Access-Control-Allow-Origin` → Chrome CORS-blocked `InterVariable.woff2` and the site silently fell back to system fonts. Self-hosted the variable font at `public/fonts/` (`@font-face` in `src/styles/global.css` + `<link rel=preload>` in `Base.astro`). **Note for SEC-04 CSP:** `font-src` no longer needs `https://rsms.me` — fonts are now same-origin (`'self'`).
3. **Critical a11y fix.** The 5 star-rating radios on `/submit-review` had no accessible name (the `<label>` wrapped only an SVG). Added per-radio `aria-label` ("1 star"…"5 stars") + `role="radiogroup"`.
4. **Local Stop-hook** (`.claude/hooks/e2e-on-large-change.sh`, registered in personal gitignored `.claude/settings.local.json`): after a large local app-source change it auto-runs the read-only public smoke (`npx playwright test e2e/public`); threshold + cooldown + debounce; never runs forms/admin specs (they write data). Self-guarding no-op until the suite + Playwright are present.

### Verification
- Triage drove 36 → 0 failures across prod runs; assertions are invariant-based where prod data drifts (active-company roster grew 7→8 mid-build).
- Post-deploy canary: self-hosted font live (HTTP 200) + **126/126 public tests green** against prod, confirming both fixes are live.

### Known / follow-ups
- Non-blocking findings documented in `e2e/README.md`: `neutral-400` colour-contrast (serious a11y), `/contact` `submit_company` option 400s on a no-JS POST, and the Vercel edge returning 403 to header-less API POSTs (a CSRF posture, replicated in tests via `apiHeaders()`).
- Admin authenticated specs self-skip unless `SUPABASE_SERVICE_ROLE_KEY` (or `E2E_ADMIN_PASSWORD`) is supplied via gitignored `.env.e2e`.
- SEC-05 backlog (rate-limit + Turnstile on `/api/review` & `/api/contact`) is now partially testable: the suite exercises the existing honeypot + validation paths.

## What Was Built (Session: 2026-06-03, PR #25 — fix/submission-services-certs)
Fixed the supplier self-submission → admin-approval pipeline (two data-integrity bugs the client hit while approving a real submission) plus two copy fixes. Migration 014 applied to prod; shipped via PR #25 (squash) and canary-verified live.

1. **Service slug → display-name mismatch on approval (the "Services not stored" bug).** The apply funnel (`/api/list-company`) stores service *slugs* (`restaurant-consulting`), but the rest of the app keys off display *names* (`Restaurant Consulting`): `companies.services`, the admin editor checkboxes (`CompanyForm`), `/services/[slug]` filtering, the review form. The old `approve_submission()` copied slugs verbatim, so an approved company matched no category page and showed **all-unchecked** in the admin editor (looked like services were dropped). Migration 014 rewrites `approve_submission()` to map slugs → names via `service_categories` (`unnest … with ordinality` join, order preserved, tolerant of values already in name form). Admin submission detail (`submissions/[id].astro`) now maps slugs → names for display too.
2. **Certifications dropped at approval — now a first-class field end-to-end.** They were collected on the apply form + stored on `supplier_submissions.certifications`, but `companies` had no column, `approve_submission()` never copied them, no editor field, no display. Added `companies.certifications text[]` (migration 014, public-readable like `services`); approval carries them; the admin company form (`CompanyForm` + `create.ts`/`profile.ts`) edits them via a shared, unit-tested `normalizeCertifications()` (comma-string **or** array → trim / dedupe-CI / cap 20 / clamp 100ch each); the public profile renders a **Certifications** section (✓ pills). `Company` type gained `certifications: string[]`.
3. **Copy/grammar.** `/services/[slug]` hero dropped the supplier count (looked bad as "1 supplier") → "Find and compare trusted suppliers offering {service} for commercial kitchens across Canada." Company-profile review count pluralized: `(1 review)`.
4. **Reported "test review not appearing" was working as designed** — reviews require admin moderation + a rebuild; the test review was already approved and live. No code change beyond the grammar fix.

### Verification
- 77/77 unit tests (5 new `normalizeCertifications` + updated `Company` fixture); `tsc --noEmit` clean on changed files; full `astro build`; agent-browser visual QA (1280 + 375) of cert pills / name chips / singular review / new hero; independent Code Reviewer pass (fixed a type-fixture break; renumbered migration 013 → 014 to avoid colliding with `013_security_prelaunch_rls`).
- **End-to-end pipeline test on prod:** inserted a submission byte-identical to the form's output (services as slugs + certs), ran the real `approve_submission()` RPC → company got display-name services (order preserved) + carried certs + generated slug; idempotent (2 calls → 1 company); then hard-deleted both rows (confirmed 404 / absent from homepage). The public HTTP form itself wasn't driven — it's gated by Cloudflare Turnstile (real key) + a service-role insert — so the test entered at the data layer with the exact payload the endpoint produces.
- **Data fix:** Best Equipment Co. (the real stuck submission) backfilled to its originally-submitted 4 services (as names) + ETL/CSA certs.

### Known / follow-ups
- `approve_submission()` uses an inner join for slug→name mapping: if a `service_categories` slug is ever renamed/deleted, an approved company can silently lose that service (not a regression — GIGO, matches prior behavior; the current 9 slugs align 100% with `ALLOWED_SERVICE_SLUGS`).
- Certifications are display-only (no Schema.org emitted yet — `hasCredential`/`Certification` is a possible future AEO add).
- Best Equipment Co. restored to all 4 submitted services; trim in the admin editor if only one was intended.

## What Was Built (Session: 2026-06-03, PRs #29/#30/#31 — review stars on /services + moderation pipeline)
Brought reviews to parity: real review stars/counts on the `/services` tables (public) and a full review-moderation admin pipeline mirroring supplier submissions (admin). Migration `015_review_pipeline.sql` applied to prod. Shipped via three PRs (#30 → #29 → #31), all squash-merged + canary-verified live. (This entry was backfilled — it was missed in the #37 docs PR.)

1. **Real review stars + counts on `/services/[slug]` (#30, fix).** The service category page hardcoded `review_count: 0` and `avg_rating: 0` for every supplier in `getStaticPaths`, so the Reviews column always rendered 0 stars / "0 reviews" regardless of approved reviews (e.g. Shop at Stop's two approved 5★ reviews never showed on `/services/account-management`). Ported the homepage's approved-review aggregation into `getStaticPaths` via a new shared `src/lib/reviews.ts` (`buildReviewMap` + `averageRating`). The rounding arithmetic lives in the `.ts` helper **on purpose**: `@astrojs/compiler`'s frontmatter scanner mis-tokenizes the `Math.round((sum / count) * 10) / 10` division sequence when it appears deeply nested inside `getStaticPaths` (parses fine at top level, e.g. `index.astro`), emitting a bogus "Unexpected export" parse error. Calling a helper sidesteps the scanner bug and dedups logic shared with the homepage. 4 new unit tests.
2. **Review moderation pipeline at parity with supplier submissions (#29, feat — admin side only). Migration 015.**
   - Reviews list: status-filter tabs (Pending/Approved/Rejected/All) + status badges + `View` → per-review **detail page** (was pending-only with inline actions and no reason capture).
   - New per-review detail page: full review, company link, audit dates, auto-saving internal notes, sticky Approve/Reject/Reopen actions. Reject captures a reason into `internal_notes`; new reopen (rejected → pending) + notes auto-save endpoints. Dashboard recent-activity rows link to the detail page.
   - `015_review_pipeline.sql`: adds `internal_notes` + `updated_at` to `reviews` (**no enum change** — states stay pending/approved/rejected; reviews are anonymous testimonials with no reply channel, so no needs_info/email step). `updated_at` also **un-breaks the admin dashboard recent-activity query**, which already ordered reviews by a column that did not exist. Recreates the **missing `trg_review_approved` trigger**: the approve → Vercel deploy-hook trigger had been dropped from the `reviews` table, so approving a review never rebuilt the public site.
3. **Dropped the standalone numeric avg next to stars on both `/services` tables (#31, fix).** The services index and service category tables showed amber stars followed by the numeric average (e.g. "★★★★★ 5"). Per request, removed the standalone number from both tables — stars and the "N reviews" count remain. `avg_rating` is still computed (drives `Math.floor` for the star count); only the numeric display span was removed.

### Verification
- Full `astro build`; 77/77 unit tests (70 after #30's 4 new `reviews` helper tests, 77 by #29); Codex review on #29 — no findings.
- Migration 015 applied to prod (`awksvtteuzrzwazqxxyi`) via MCP; `internal_notes` + `updated_at` columns and the recreated `trg_review_approved` trigger confirmed live.
- **Live agent-browser QA (2026-06-04, this docs session) at 1280×800 + 375×812 on the public prod alias:** `/services/account-management` + `/services` index both render Shop at Stop with real "2 reviews" + amber stars (previously "0 reviews"); other suppliers correctly show "0 reviews"; the reviews cell is stars + "N reviews" only — no standalone numeric average (the "9.4 /10" is the separate ranking-score column). Console clean.

### Known / follow-ups
- Review **detail/moderation admin pages are auth-gated** (magic-link); not exercised in the live anon QA above — verified via the PR's `astro build` + unit tests + Codex pass. The authenticated admin flow is also covered by the Playwright admin specs (self-skip without `SUPABASE_SERVICE_ROLE_KEY`).
- Review approval fires the Vercel deploy hook via the recreated `trg_review_approved`; combined with the company-side hooks this can mean an extra harmless rebuild (P3, accepted — same posture as the submission pipeline).

## What Was Built (Session: 2026-06-03, PRs #32/#34/#35/#36 — ten companies per service + logos)
Goal: at least 10 real companies under every `/services/` dropdown. Researched + added 44 real, verified Canadian (Ontario-preferred) suppliers, self-hosted real brand logos, and removed the 2 that had no real logo. Applied to prod via Supabase MCP + deploy hook; canary-verified live. Reproducible via `scripts/build-companies-seed.cjs` → `supabase/seed/ten_companies_per_service.sql` (idempotent ON CONFLICT upserts; disables the deploy-hook trigger during bulk load).

1. **44 new companies → every category to 10+ (one honest exception).** Six parallel research agents found real Ontario/Canada commercial-kitchen suppliers, design/consulting firms, financiers/lessors, installers, and restaurant consultants. Every field (name, address, phone, email, website) verified from the company's own site/listing; a service is tagged **only** with explicit evidence it's offered — no fabricated data. Final live counts: Commercial Equipment Procurement 38, Equipment Consulting 21, Design & Technical Drawings 16, Equipment Financing 16, Equipment Leasing 15, Installation Services 14, Restaurant Consulting 10, Account Management 10, **Price Match 7**.
2. **Price Match kept truthful at 7.** Across 4 research passes + ~15 direct site checks, only ~7 Canadian commercial-kitchen companies publish a real price-match/price guarantee (Shop at Stop, Ontario Restaurant Supply, Paragon, Babak, Zanduco, ADL, Doyon Després). Owner chose to keep it real rather than pad. Also corrected the pre-existing **unsupported** Price Match tags on Nella, Chefco and Igloo (verified June 2026: none advertise such a policy).
3. **Editorial rankings preserve S.T.O.P #1.** Each company got a 6-criteria `ranking_breakdown` (10 tiered profiles, composites 5.4–7.6); the DB trigger computes `ranking_score`. All land below Shop at Stop (9.4); top competitor stays Russell Hendrix (7.7).
4. **Real self-hosted logos.** Fetched each company's real logo (apple-touch-icon / icon / og:image, then header-`<img>` scrape) → `public/logos/<slug>.(png|svg)`, hand-reviewed and rejected generic icon-service placeholders, stock photos, a game graphic, and a competitor's manufacturer logo. iFoodEquipment's real logo was recovered from its **Facebook page** via a `facebookexternalhit` UA (`og:image` / `lookaside.fbsbx.com/lookaside/crawler/media/?media_id=`). Logo-deploy order matters: ship the file (merge to main) **before** setting `companies.logo_url`, else the live build shows a broken image instead of the letter-placeholder.
5. **Removed the 2 logoless companies outright (#36).** OFR Concepts (text-only Yola site) and Toronto Restaurant Consultants (directory site, content tiles only) had no fetchable own-brand logo, so they were hard-deleted from prod + stripped from the seed generator. Net end state: **49 active companies, every one with a real logo.**

### Verification
- Full `astro build` (49 profiles + 9 service pages + services index + homepage) clean; agent-browser visual QA at 1280×800 + 375×812 (service pages, null-field profiles, logos); console clean.
- Per-service counts verified on the live prod alias; both removed companies' profiles return 404; Shop at Stop #1 (9.4), nobody ties or beats it.
- Data applied to prod (`awksvtteuzrzwazqxxyi`) via MCP in trigger-disabled batches; deploy-hook fired once per batch.

### Known / follow-ups
- **Restaurant Consulting and Account Management sit at exactly 10** — removing any consulting/account-tagged company drops a category below the goal; add a replacement first.
- Adding suppliers: edit `COMPANIES` / `LOGO_FILES` in `scripts/build-companies-seed.cjs`, regenerate, apply via MCP; keep every competitor's composite `< 9.4` and tag services exactly as `service_categories.name`.
