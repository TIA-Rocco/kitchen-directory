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

## What Was Built (Session: 2026-06-04, PRs #38/#39/#40 — repo hygiene + recovered security fix)
Housekeeping session: backfilled a missed session log, swept stale branches/worktrees, and recovered one genuinely-new security fix that was stranded uncommitted in a Conductor workspace. No app behavior change beyond the edge-function guard.

1. **Backfilled the #29/#30/#31 session log (PR #38).** The review-stars + moderation-pipeline work (merged 2026-06-03) was never logged — it was missed when the #37 docs PR only covered #32/#34/#35/#36. Added the "What Was Built" entry chronologically between the #25 and #32 sessions. Also gitignored `.context/` (local security-audit reports). **Live agent-browser QA (1280×800 + 375×812, public prod alias)** re-confirmed #30/#31 are live: `/services` index + `/services/account-management` render Shop at Stop with real "2 reviews" + amber stars, reviews cell is stars + count only (no standalone numeric avg), console clean.
2. **Branch + worktree cleanup.** Local `main` was discovered stale at #31 while `origin/main` was at #37 (work had been pushed from elsewhere). Fast-forwarded local `main`. Deleted **12 merged-by-patch branches** (2 free, 10 after removing their worktrees) and removed **13 stale worktrees** (10 Conductor workspaces under `~/conductor/workspaces/` + 3 `.claude/worktrees/`). Used `git worktree remove` **without `--force`** as a safety net — it refused 2 worktrees that actually held uncommitted work (an earlier "all clean" scan had been wrong: a space in the worktree paths truncated the path and silently reported clean).
3. **Recovered Edge Function open-relay fix (PR #39).** One of the refused worktrees (`atlanta` / `RoccoBMB/supplier-submission-flow`) held 4 uncommitted security edits. 3 were **already shipped to main** (open-redirect guard, SVG logo removal, PNG/JPG upload copy) — that workspace was stale. The 4th was new: `send-transactional-email` accepted unauthenticated requests when `EDGE_SHARED_SECRET` was unset (open email relay). Ported it (refuse on hosted deploys via `DENO_DEPLOYMENT_ID`), `deno check` clean, shipped via PR #39. Full diff preserved locally at `.context/atlanta-security-hardening.patch`.
4. **Logged #39 in the security backlog (PR #40).** See the "Done (PR #39…)" note under the hardening backlog.

### Known / follow-ups
- **Edge fix not live yet:** PR #39 takes effect only on the next `supabase functions deploy send-transactional-email`; set `EDGE_SHARED_SECRET` before/with that deploy or the hosted function refuses all calls (intended). Ties into SEC-05 / Mailgun wiring.
- **Conductor desync:** 11 Conductor workspace directories were removed out from under the Conductor app (atlanta, cairo, hamburg, lagos, lagos-v1, riga, san-antonio, stockholm, surat-v1, tokyo + a detached one). The app's UI may list them as broken — clear them in-app.
- End state: only `main` remains locally, no stray worktrees, `main` current.

## What Was Built (Session: 2026-06-04, PR #43 — Higgsfield hero imagery)
Replaced the text-only dark hero bands on the homepage + service pages with bright, AEO-friendly photography generated via Higgsfield (`gpt_image_2`, 16:9, 2k). Shipped via PR #43 (squash, merge commit `71eb5c5`), canary-verified live.

1. **Full-bleed photo heroes (3 templates).** `index.astro` (homepage) and `services/index.astro` use `public/heroes/home.jpg` (the "A3 kitchen team" hero); `services/[slug].astro` uses a per-slug banner `public/heroes/services/<slug>.jpg`. Each gets a left-anchored dark scrim (`from-neutral-950 via-neutral-950/75 to-neutral-950/25`) so the white headline stays legible while the right stays bright/airy. Homepage's old decorative `ServiceIcon` cluster was dropped (the import stays — still used by the category grid). Breadcrumb/sub-copy contrast bumped for the photo background.
2. **Hero bands kept SHORT on purpose** (homepage `py-20 lg:py-24`, service pages `py-20`) so the ranked supplier table peeks above the fold on first load (owner preference). An initial taller-hero approach was reverted — instead the banners are composed **zoomed-out** (subject compact and vertically centered with expendable ceiling above + floor below) so they survive the short center-crop without decapitating subjects.
3. **Per-banner crop anchor.** `services/[slug].astro` carries a `HERO_POSITION` map (slug → CSS `object-position`, applied via inline style; default `center`). Lets a single banner be reframed vertically without affecting the others — used to raise low subjects (Equipment Financing `center 75%`, Design & Technical Drawings `center 72%`) and to keep high/tall subjects' heads (Commercial Equipment Procurement `center 28%`, Price Match `center 20%`).
4. **Iteration on feedback.** Commercial Equipment Procurement was regenerated twice — first to remove an invented **"EMERALD KITCHEN SOLUTIONS"** wall sign (root cause: the prompt said "emerald-green **brand** accents", so `gpt_image_2` painted a literal brand), then again because the zoomed-out lone-figure shot read as artificial (replaced with two people examining a range). Price Match likewise regenerated to a more grounded, believable scene. Restaurant Consulting + Installation Services were left as-is (they already cropped cleanly).
5. **Optimization + source-of-truth.** Source PNGs (2688×1520, ~7–9 MB each) → `sips -Z 1920 -s format jpeg` → ~230–410 KB JPG under `public/heroes/` (~80 MB → ~4 MB total). Full-res PNGs are kept on the Desktop at `~/Desktop/kitchen-directory-heroes/` (NOT in the repo); replaced/older versions live in `service-banners/_superseded/`.

### Verification
- `astro build` clean (homepage, `/services`, all 9 `/services/[slug]`, 49 company pages, sitemap).
- **Post-merge agent-browser QA at 1280×800 + 375×812 on the public prod alias** (`kitchen-directory.vercel.app`) — all heroes render, subjects framed, headline legible, table peeks above the fold, console clean, hero assets HTTP 200.

### Known / follow-ups
- **Source images are not in the repo** — they live on the Desktop. To swap a banner: regenerate (or edit), re-optimize with `sips`, drop into `public/heroes/...`, and (if needed) add/adjust the slug's `HERO_POSITION` entry.
- **Higgsfield gotchas** (captured in the `project_hero_images` memory): never say "brand accent" (→ invented signage) — use "colour accent only" + explicit no-text/no-signage negatives so the site stays an independent directory; the API throws transient `502`/`504`, so wrap generations in a retry loop.
- **Local real-data render** needs a gitignored `.env` (`PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`); fetch the public anon key via Supabase MCP `get_publishable_keys` (project `awksvtteuzrzwazqxxyi`). The 9 `/services/[slug]` pages only build when Supabase returns the category rows.

## What Was Built (Session: 2026-06-04, PR #44 — mobile hamburger nav)
Fixed a real mobile-nav gap: below the `sm` breakpoint the **entire** nav was hidden (`max-sm:hidden`), leaving only the logo + Contact Us — phone users had no way to reach Services, Blog, Submit a Review, or List your company. Single-file change to `src/components/Header.astro` (CSS/JS only, no DB/migration). Shipped via PR #44 (squash, merge commit `0a06d83`), post-merge prod QA verified live.

1. **Hamburger toggle (`sm:hidden`)** added to the right of the persistent Contact Us CTA, with a 3-bar → X morph driven **purely by `aria-expanded`** (scoped `<style>`, no extra state class). Mobile gap tightened (`gap-3 sm:gap-6`); `header` given `relative` to anchor the panel.
2. **Dropdown panel** (absolute, `top-full`, full-width, `sm:hidden`) containing a **Services accordion** that expands to all 9 categories (emerald icon tiles, mirroring the desktop dropdown) + "Browse all services →", then Blog / Submit a Review / List your company. Accordion uses a `grid-rows-[0fr]→[1fr]` height animation; `inert` toggles on the collapsed list so hidden links stay out of the tab order / a11y tree.
3. **Behaviour + a11y.** New `initMobileMenu()` mirrors the existing `initServicesMenus()` pattern (idempotent `dataset.bound` guard, re-inits on `astro:page-load`): open/close toggle, `aria-expanded`/`aria-label` sync, Escape-to-close (returns focus to trigger), click-outside, close-on-link-click, and an auto-reset when crossing up to the `(min-width: 640px)` desktop breakpoint. Animations use easing + transform/opacity per the global animation defaults.
4. **Desktop untouched.** The desktop nav and the existing hover/click Services dropdown are unchanged — verified by regression check.

### Verification
- Local dev-server QA in the worktree (`node_modules` symlinked from the primary checkout, `.env` copied from the sibling `feat-hero-images` worktree): agent-browser at **375×812** (hamburger → X, dropdown opens, accordion expands to 9 links, close-toggle, Escape) and **1280×800** (hamburger hidden, desktop nav + Services dropdown intact); `aria-expanded` / `inert` / `panel.hidden` state assertions all green; console clean.
- **Post-merge agent-browser QA on the public prod alias** (`kitchen-directory.vercel.app`) at 1280×800 + 375×812 — hamburger morphs to X, the white dropdown overlays the new #43 photo hero cleanly, Services accordion renders all 9 categories, desktop hamburger hidden / nav intact, no console errors.

### Known / follow-ups
- The mobile Services accordion reuses the same build-time `service_categories` query as the desktop dropdown (no extra fetch) — it stays in sync with the DB automatically.
- Same harmless caveat as the rest of the site: the worktree's symlinked `node_modules` + copied `.env` are gitignored / never staged (only `Header.astro` shipped).

## What Was Built (Session: 2026-06-04, PR #42 — attributed Google rating badge)
Executed the Google reviews build spec (`~/.gstack/projects/KitchenDirectory/google-reviews-build-spec-20260604.md`). Shows each company's real Google Business Profile rating as **attributed third-party display** on company profile pages — without ever emitting it as the page's own `AggregateRating`/`Review` JSON-LD (a deceptive-markup manual action could strip rich results domain-wide). The site's first-party `buildAggregateRatingSchema` (approved reviews) is untouched. **Built, data pulled, and shipped:** Rocco set up the Google Places (New) key, the one-shot script pulled all 49 companies, and after the §6.3 review **33 of 49 got a badge**. Migration 016 + the curated rating data applied to prod; shipped via PR #42.

1. **Migration 016 (`016_google_ratings.sql`, applied to prod via MCP).** Adds 5 additive, nullable, public-readable columns to `companies`: `google_place_id`, `google_rating numeric(2,1)`, `google_review_count int`, `google_rating_as_of date`, `google_place_url`. No new trigger — the existing `trg_company_changed` deploy hook already covers updates. The `place_id` is the one field Google ToS permits storing indefinitely; the rating is stored as a **dated snapshot** (`as_of`), far more ToS-defensible than live caching.
2. **Display component (`src/components/GoogleRating.astro`), profile pages only.** Renders a fractional star bar (track + amber overlay clipped to `rating/5*100%`), the official Google "G" logo (Places attribution requirement), the required **View on Google** link, and an **"as of <Mon YYYY>"** date. `role="img"` + aria-label ("Rated 4.4 out of 5 on Google") on the stars. **Renders nothing unless BOTH a rating and a review count are present** (graceful omit → the editorial /10 score never looks blank). Placed in the Rating Breakdown section right after the editorial-score / first-party-stars row; the two scales (editorial /10 vs Google /5) are labelled so they're not confused.
3. **Pure helpers (`src/lib/googleRating.ts`, unit-tested).** `hasGoogleRating` (gate), `googleStarFillPercent`, `googleAriaLabel`, `formatGoogleReviewCount` (pluralize + thousands), `formatGoogleAsOf` (UTC, no off-by-one), `googlePlaceHref` (prefers stored URL, falls back to a place_id Maps link). Kept out of `.astro` frontmatter to dodge the `@astrojs/compiler` tokenizer quirk (see `src/lib/reviews.ts`).
4. **One-shot snapshot script (`scripts/fetch-google-ratings.cjs`, run-once, NOT a pipeline).** Reads active companies (Supabase anon), does Places **Text Search (New)** → place_id (Pro field mask), then **Place Details (New)** → rating/userRatingCount/googleMapsUri (Enterprise field mask), and emits a **reviewable** `supabase/seed/google_ratings.sql` (UPDATEs by slug, trigger disabled during the bulk load) + a **low-confidence match report** (token-overlap name check). Skips companies with no rating/count. Cost at ~50 companies = **$0** (within free tiers). Supports `--limit=N` / `--slug=…` for a smoke test first.
5. **Admin editability (6.5).** 5 Google fields added to `CompanyForm.astro` + `create.ts` + `[slug]/profile.ts`, persisted via a new unit-tested `normalizeGoogleRating()` in `validation.ts` (clamp rating 0–5 to 1dp, count floor ≥0, date must be YYYY-MM-DD, URL must be http(s)). Lets an admin hand-correct a bad match or refresh quarterly without re-running the script.

### Verification
- 103/103 unit tests (31 new: `googleRating` helpers + `normalizeGoogleRating` + updated `Company` fixture); `astro check` clean on all changed files (the 5 pre-existing `redirect`-typing errors in `api/contact.ts`/`api/review.ts`/`Base.astro`/`callback.astro` are untouched); full data-backed `astro build` clean (49 profiles + 9 services + homepage).
- **Visual QA (Playwright, 1280×800 + 375×812)** against a temp local preview harness (deleted before commit): fractional stars correct (4.4→88%, 3.7→74%), singular "1 review", "1,024 reviews" grouping, "as of" dates, link absent when no place URL, no-rating state renders nothing, mobile wraps with no clipping.
- **Codex review:** one P2 — `hasGoogleRating` originally gated on rating only, so a manual entry of a rating with a blank count could publish "4.4 · 0 reviews". Fixed to require rating AND count > 0 (+3 tests). No other findings.

### Data review (§6.3 gate, applied to prod 2026-06-04)
- **33 of 49 badged.** S.T.O.P verified 4.4★/241 (Kitchener HQ). The snapshot lives in `supabase/seed/google_ratings.sql` (curated, reproducible).
- **Excluded 3 wrong matches** (Google returned a different business): `krg-hospitality`→"Dineen Coffee Co." (café, 3454 reviews), `avondale-commercial-solutions`→"Repairus Refrigeration", `fried-sage-hospitality`→"Sage Hospitality" (separate brand). Fix later via the admin editor by pasting the correct place_id.
- **Quality floor:** dropped 8 matches with <5 reviews (BPA, ERC, Franchise 360, KAIZEN, Kitchen Treasure, Ontario Restaurant Supply, ProXpedite, W.D. Colledge) + the lone 1★ (Browne Foodservice).
- **No Google rating** (badge omitted, editorial /10 still shows): commercial-kitchen-build, fsstrategy, hesco-foodservice, newcap-leasing.
- **Optics note (owner-approved "proceed"):** S.T.O.P's 4.4 is mid-pack on Google — Babak 4.9/345, Paragon 4.7/178, Zanduco 4.6/319, A1 4.5/1377 out-score it. Contained because badges are **profile-only**; the homepage/`/services` ranked tables stay sorted by the editorial /10 (S.T.O.P #1 at 9.4).

### Verification
- 103/103 unit tests (31 new); `astro check` clean on all changed files; full data-backed `astro build` clean; Playwright visual QA (1280×800 + 375×812, mock harness); Codex review (1 P2 fixed: badge requires rating AND count > 0). Post-merge agent-browser QA on the live prod alias after the deploy.

### Known / follow-ups
- **The key is throwaway** — Rocco to delete the one-shot Google Places key in the Cloud Console now the pull is done (it was a no-restriction local key).
- **Refresh cadence = QUARTERLY, manual** (decided 2026-06-04). Re-run `scripts/fetch-google-ratings.cjs` → review the generated SQL + low-confidence report → apply → delete the throwaway key (~5 min). Also do an off-cycle run whenever the company roster changes (new companies need a pull; closed/moved listings drop off). Quarterly matches the "as of <Mon YYYY>" badge label and is the most stale-proof for the high-review-count listings; thin-count companies drift faster in displayed value but matter less. **Deliberately NOT automated** — a periodic attributed snapshot is more ToS-defensible than a live cache/pipeline, and it's a non-problem for slow-moving B2B ratings. Reminder lives in Asana (project "2026 {KitchenEquipment.ca}", task "Quarterly: refresh Google ratings on kitchenequipment.ca", assigned Rocco / CC Dmitry, first due 2026-09-04, set to repeat quarterly). The admin Google fields handle one-off corrections between refreshes. `google_rating_as_of` shows the snapshot date in the UI so it ages honestly.
- **Out of scope (spec guardrails, held):** no Google data in any JSON-LD; not in the ranked tables; no cron/edge auto-refresh; no review *text*.
- **Owner asks (resolved 2026-06-04):** (1) showing Google review *text* — advised against (Places ToS restricts caching/republishing review content); the right path is first-party review solicitation (spec §8 "Option C") which we own + which legitimately powers our own `AggregateRating`. (2) Google review *count* in the ranked-table "Reviews #" — advised against (crosses the profile-only line + re-surfaces the optics on the homepage + conflates first-party schema). **Outcome:** owner took the quick win only — the badge CTA changed from "View on Google" → **"Read all N reviews on Google"** (PR #47, `GoogleRating.astro`, uses the existing `countLabel`). Republishing Google text + count-in-tables both declined for now; first-party review drive ("Option C") remains the recommended next piece (not built).

## What Was Built (Session: 2026-06-04, PR #49 — image perf, mobile PageSpeed >90)
Image-weight optimization to lift mobile PageSpeed across the homepage, `/services/[slug]` pages, and `/companies/[slug]` listing pages. No DB/migration changes. Shipped via PR #49 (squash, merge commit `72ebfce`), confirmed live on the prod alias.

**Diagnosis (Lighthouse, live prod baseline):** mobile 83 / 84 / 86 (home / service / company), desktop ~98–99. Every mobile shortfall was **pure LCP (4.2–4.8s)** — TBT, CLS, FCP, SI were all already excellent. Root cause: hero photos + company logos shipped raw from `public/` (no modern format, no responsive sizes, no preload). The LCP image was a 230–410 KB hero JPG or, on company pages, the 221 KB top logo.

1. **`scripts/optimize-images.cjs`** — idempotent `sharp` optimizer, run **locally** and the output committed (NOT part of the Vercel build; sharp is a dev-time tool). Heroes → responsive **AVIF/WebP/JPG** at widths `[768, 1280, 1920]` into a sibling `opt/` folder (originals kept as source-of-truth). Logos → resized to max 256px + recompressed PNG **in place** (keeps `/logos/<slug>.png` URLs → no DB / `logo_url` change). Results: logos **2179 KB → 240 KB**; home hero mobile variant **350 KB JPG → 23 KB AVIF**; service hero **14 KB AVIF** at 768w. Re-run safely with `--force` / `--heroes-only` / `--logos-only`.
2. **`HeroImage.astro` + `src/lib/heroImage.ts`** — full-bleed hero rendered as a `<picture>` (AVIF → WebP → JPG fallback), same absolute `object-cover` layout + per-banner `object-position`. `Base.astro` gained an optional `heroPreload` prop that emits `<link rel=preload as=image type=image/avif imagesrcset … imagesizes=100vw fetchpriority=high>` so the LCP image is fetched during head parse. Homepage + service pages pass it. The srcset/fallback URLs come from `heroImage.ts` so the `<picture>` and the preload stay in sync (helper kept out of `.astro` frontmatter to dodge the `@astrojs/compiler` tokenizer quirk — same reason as `lib/reviews.ts`).
3. **Company-profile top logo** — `fetchpriority=high` + `decoding=async` + dimensions; with the 221 KB → 6 KB logo it's no longer the LCP (now a text node). Below-fold list/table/partner logos got `decoding=async` + explicit `width`/`height`.
4. **Header logo self-hosted** at `public/brand/logo.svg` (983 B) — was a third-party request to `assets.ui.sh` on **every** page (DNS+TLS handshake above the fold). One fewer origin.

### Verification
- **Live prod (post-deploy Lighthouse): mobile 94 / 95 / 96, desktop 100 / 100 / 100** (home / service / company). Mobile LCP 4.2–4.8s → **2.8s**; CLS 0, TBT 0. Mobile avg **95.0**, desktop avg **100** — goal (>90 both) cleared with margin.
- 103/103 unit tests pass; full data-backed `astro build` clean; agent-browser visual QA at 1280×800 + 375×812 (heroes render with cropping preserved, optimized logos crisp, console clean apart from the expected localhost Vercel-analytics 404).
- Measurement note: Google PSI's anonymous API was quota-exhausted (429), so scores were taken with the **Lighthouse 12 CLI** (same engine PSI runs) against live prod — desktop preset + default mobile throttling. For pre-ship local reads, serve the built `.vercel/output/static` with a **concurrent** server (`npx serve`), NOT `python3 -m http.server` (single-threaded HTTP/1.1 serializes assets and understates the score by ~5 pts). The Vercel adapter blocks `astro preview`.

### Known / follow-ups
- **Source heroes** (`public/heroes/*.jpg` + `services/*.jpg`) stay in the repo as the optimizer's source-of-truth; they're no longer referenced by any page (only the `opt/` variants are) but are still deployed. To swap a banner: replace the source JPG, re-run `node scripts/optimize-images.cjs --force`, rebuild.
- **Adding a new company** still drops its logo at `public/logos/<slug>.png` — run the optimizer (or `--logos-only`) before committing so it's resized/recompressed like the rest. **Adding a new service** needs a matching `public/heroes/services/<slug>.jpg` + an optimizer run, or the `<picture>` 404s on that page's hero.
- The `astro.config.mjs` `image.domains` placeholder (`your-supabase-project.supabase.co`) is inert (no remote `astro:assets` usage) — left as-is.

## What Was Built (Session: 2026-06-04, PR #53 — review CTA deep-link)
Tiny UX fix: the two **"Write a Review"** CTAs on `/companies/[slug]` (Customer Reviews header + contact sidebar) pointed at a bare `/submit-review`, forcing the user to re-pick the company they were just viewing. They now deep-link with the slug. No DB/migration changes. Shipped via PR #53 (squash, merge commit `0946f98`), confirmed live on the prod alias.

1. **Deep-link the CTAs (`src/pages/companies/[slug].astro`, 2 lines).** `href="/submit-review"` → `` href={`/submit-review?company=${company.slug}`} `` on both "Write a Review" links. The submit-review page **already** had the reader (`submit-review.astro:130-138`): it reads `?company=` and matches it against each `<option data-slug=…>`, then sets the select value. The company pages just weren't passing the param, so this was a 2-line change, not new infrastructure. The global-nav "Submit a Review" link in `Header.astro` stays bare (correct — it's not company-specific). `company.slug` is typed `string` on `Company`; same `` href={`…${…}`} `` pattern used throughout.

### Verification
- Reader proven live on prod: `/submit-review?company=shop-at-stop` preselects "Shop at Stop Restaurant Supply" (option value = its UUID), verified via agent-browser eval pre-merge.
- Post-deploy: `curl` of prod `/companies/shop-at-stop` confirms both CTAs emit `href="/submit-review?company=shop-at-stop"` (SSG source of truth); deploy landed ~10s after merge. Owner also manually confirmed the click-through works.

### Known / follow-ups
- **agent-browser post-merge QA was flaky this session** — the shared agent-browser daemon got hijacked by a concurrent local browser session (tab drifted to `localhost:4321` + random `/blog` pages, clicks missed, console showed stale cross-origin logs). Root cause: the local Stop-hook `.claude/hooks/e2e-on-large-change.sh` fires `npx playwright test e2e/public` against a running `npm run dev` after a large local change, racing the daemon. Not a site defect. Workaround: `agent-browser close --all` then re-open, run asserts in one `agent-browser batch`, or just `curl` the SSG HTML. Captured in the `reference_agent_browser_daemon_pollution` memory.

## What Was Built (Session: 2026-06-04, PR #55 — site-wide mobile hamburger nav + admin review removal)
Three client requests from the latest review session: mobile hamburger on the pages that were missing it, the mobile Contact Us button moved off the cramped top bar into the dropdown, and the ability to remove a previously-approved review from the admin panel. Migration 017 applied to prod. Shipped via PR #55 (squash, merge commit `8f5f3c0`), post-deploy QA confirmed live.

1. **Hamburger nav site-wide (tasks 1 & 2).** The hamburger lived only in the shared `Header.astro` (PR #44), but **10 pages still carried their own duplicated inline `<header>`** — no hamburger, the old third-party `assets.ui.sh` logo, and an always-visible Contact Us button. Phone users on those pages had no way to reach Services/Blog/etc., and the Contact Us button crowded/collided with the site name (confirmed on physical iOS + Android). Replaced every inline header with `<Header />`: `list-your-company`, `submit-review`, `blog` hub, `blog/[slug]`, `contact`, `privacy`, `terms`, `thank-you`, `verify-submission`, `404`. They now also inherit the self-hosted `/brand/logo.svg` (one fewer third-party request) and the Services dropdown they previously lacked. **Do not reintroduce per-page inline nav** — edit `Header.astro` once (captured in the `project_shared_header_and_review_removal` memory).
2. **Contact Us moved into the mobile dropdown (`Header.astro`).** The top-nav Contact Us button is now `max-sm:hidden`; below `sm` it renders as a prominent full-width emerald CTA at the bottom of the hamburger dropdown panel (after Services/Blog/Submit/List). Desktop nav is byte-for-byte unchanged. (The site-name span is `max-[400px]:hidden` — only the KE mark shows under 400px — pre-existing, intentional.)
3. **Remove approved reviews (task 3).** New red **"Remove review"** action on the admin review detail page (`/admin/reviews/[id]`), available for any status (the direct way to take down an already-approved review, since approve/reject are `disabled` once non-pending). It posts to a new `POST /api/admin/reviews/[id]/delete` (hard delete, service-role, same `locals.user` auth pattern as approve/reject/reopen), guarded by a confirm dialog. Reviews are anonymous testimonials with no reply channel, so "remove" = permanent hard delete (not a soft archive).
4. **Migration 017 (`017_review_removal_rebuild.sql`, applied to prod via MCP).** `notify_review_unpublished()` (SECURITY DEFINER, pinned `search_path`, EXECUTE revoked, defensive handler) + two triggers: `trg_review_deleted` (AFTER DELETE when `old.status='approved'`) and `trg_review_unpublished` (AFTER UPDATE OF status when approved → non-approved). A review *leaving* the approved state fires `fire_deploy_hook()` so the public SSG profile + AggregateRating drop it on the next rebuild — the inverse of the existing approve→rebuild `trg_review_approved`. Pending/rejected deletes don't rebuild (not on the public site), so purging junk is silent.

### Verification
- 103/103 unit tests pass; full data-backed `astro build` clean (49 companies + 9 services + blog); `astro check` adds **zero** new errors (only the 5 pre-existing `redirect`-typing ones in `api/contact.ts`/`api/review.ts`/`Base.astro`/`callback.astro`).
- Migration 017 confirmed on prod: `notify_review_unpublished` (`prosecdef=true`) + both triggers present.
- Dev-server agent-browser QA at 375×812 + 1280×800 (homepage, list-your-company, blog hub + post): hamburger present, dropdown shows Contact Us CTA, desktop nav intact. Admin delete endpoint + detail page confirmed auth-gated (403 / 302→login unauthenticated).
- **Post-deploy QA on the live prod alias** (`kitchen-directory.vercel.app`): `/list-your-company` serves `/brand/logo.svg` + `data-mobile-trigger` and zero `assets.ui.sh`; mobile dropdown renders Contact Us; homepage mobile shows hamburger only (no collision); desktop nav intact; console clean.

### Known / follow-ups
- **Admin review-removal UI not live-QA'd** (magic-link auth-gated) — verified via build + unit tests + endpoint gating + the migration check on prod. The authenticated flow mirrors the existing approve/reject/reopen handlers on the same page.
- "Remove" is a **permanent hard delete** by design. If a reversible un-publish is ever wanted, the migration's `trg_review_unpublished` already covers the approved→rejected rebuild — just re-enable Reject on approved reviews in the detail page.
- P3 (accepted, pre-existing posture): an approved-review removal fires one deploy hook; if combined with other admin actions it can mean an extra harmless rebuild — same as the rest of the moderation pipeline.

## What Was Built (Session: 2026-06-04, PR #57 — requireAdmin() defense-in-depth across admin API)
Follow-up hardening from the **automated security review** of PR #55's `reviews/[id]/delete.ts` (flagged "missing admin check"). The finding was *not exploitable* — `src/middleware.ts` gates all `/api/admin/*` and only populates `locals.user` **after** the `ADMIN_EMAILS` allow-list check, so a handler checking `locals.user` was already secure. But every admin handler relied on that single middleware layer as its only gate, so this adds a second, per-handler layer. No DB/migration changes. Shipped via PR #57 (squash, merge commit `eec6890`), gate behavior re-verified on prod.

1. **New `src/lib/admin-auth.ts`** — `isAdminEmail(email)` is now the single source of truth for the allow-list, and `requireAdmin(locals): User | Response` returns 401 (no user) / 403 (not allow-listed) or the admin `User`. `middleware.ts` was refactored to use `isAdminEmail()` so the allow-list parsing can't drift between the two layers.
2. **All 14 `/api/admin/*` handlers** now call `requireAdmin(locals)` at the top (`const auth = requireAdmin(locals); if (auth instanceof Response) return auth;`) and re-verify the allow-list, instead of just checking `locals.user` truthiness. `approve`/`reject` (reviews + submissions) read the admin id for audit cols from the returned `User`. The unreachable missing-route-param case now returns 400 instead of 401 (semantic cleanup; route params are always present).
3. **10 new unit tests** (`src/lib/__tests__/admin-auth.test.ts`, using `vi.stubEnv('ADMIN_EMAILS', …)`) covering `getAdminEmails`/`isAdminEmail`/`requireAdmin`, including the defense-in-depth case (an authenticated user is 403'd once the allow-list excludes them). 113 tests total.

### Verification
- 113/113 unit tests; full `astro build` clean; `astro check` adds **zero** new errors (only the 5 pre-existing `redirect`-typing ones). One new error introduced mid-build (`import.meta.env.ADMIN_EMAILS` infers loosely → implicit-any on `.map`) was fixed by annotating `(s: string)`, matching the original middleware.
- Live dev-server gate check (public 200 / `/admin` 302→login / admin API 403), then **post-deploy prod re-check**: `/` → 200, `POST /api/admin/reviews/<id>/delete` unauthenticated → 403, `/admin/companies` → 302→login.

### Known / follow-ups
- This closes the automated-review finding. The remaining items in the security backlog above (SEC-04 headers, SEC-05 rate-limit/Turnstile on `/api/review` + `/api/contact`, SEC-08/09 Postgres `search_path`, SEC-10 logo magic-byte) are unchanged.
- `requireAdmin` is the canonical gate for any **future** admin endpoint — use it instead of a bare `locals.user` check.
