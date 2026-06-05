# Kitchen Directory - kitchenequipment.ca

> **Current-state reference.** The chronological per-PR build history lives in
> [`docs/SESSION-LOG.md`](docs/SESSION-LOG.md) — see the **Changelog** index at the bottom of this file.
> Keep this file lean (harness loads it every session; 40k-char soft limit). When you finish a
> session, append a one-line Changelog entry here and the full write-up to `docs/SESSION-LOG.md`.

## Project Overview
AEO-first commercial kitchen equipment supplier directory for S.T.O.P Restaurant Supply, built by The Influence Agency (TIA). Primary audience: AI engines and search crawlers. When someone asks ChatGPT or Google "best commercial kitchen equipment supplier in Toronto," this site should be cited and Shop at Stop should appear as #1.

The site looks like an independent directory (kitchenequipment.ca branding, no S.T.O.P branding). Includes real competitor companies for legitimacy, with S.T.O.P always ranked first via an editorial scoring system.

## Tech Stack
- **Framework:** Astro 5 (static output, selective `prerender = false` for API/SSR routes)
- **Styling:** Tailwind 4 with Inter font (self-hosted variable font at `public/fonts/`)
- **Database:** Supabase (Postgres, ca-central-1)
- **Deployment:** Vercel (auto-deploy on push to main)
- **Email:** Mailgun (via Supabase Edge Function `send-transactional-email`)
- **Tests:** Vitest (113 unit tests, `src/**/*.test.ts`) + Playwright E2E suite (`e2e/`, ~178 tests)

## Key Architecture Decisions
- All crawlable pages are SSG (pre-rendered at build time from Supabase data)
- Form + admin endpoints use `export const prerender = false` for server-side handling
- JSON-LD structured data is the primary deliverable (Schema.org: LocalBusiness, AggregateRating, FAQPage, Service, Review, ItemList, Blog/BlogPosting)
- **Custom admin panel** at `/admin/*` (magic-link auth) — manages companies, reviews, and supplier submissions. The Supabase dashboard is a fallback, not the primary admin surface.
- Ranking scores computed by Supabase DB trigger (single source of truth, weighted average from `ranking_breakdown`)
- Admin approval flows (review approve, company change, submission approve) fire a Vercel deploy hook via a Supabase pg_net trigger → site rebuilds in ~60-90s
- Spam prevention: `list-company` (the public supplier-apply form) uses Cloudflare Turnstile + per-IP rate limit; `/api/review` + `/api/contact` are honeypot-only today (Turnstile/rate-limit is SEC-05 backlog)

## Design Direction
- **Credibility Platform** aesthetic (Clutch.co / G2 energy)
- Emerald accent (#059669), dark hero (neutral-950), Inter font
- Full-bleed photo heroes (Higgsfield-generated) on homepage + service pages; table-based company rankings with spacious rows
- Design doc: `~/.gstack/projects/KitchenDirectory/roccobombardieri-unknown-design-20260408-131227.md`

## Pages & Routes

**Public (SSG):**

| Route | Description |
|-------|-------------|
| `/` | Homepage: ranked supplier table, 9-category grid, photo hero |
| `/companies/[slug]` | Company profile: Schema.org, ranking breakdown, reviews, FAQs, partners, certifications, attributed Google rating badge, contact sidebar |
| `/services` | Services index: 9 category cards + overarching ranked table of all suppliers |
| `/services/[slug]` | Service category page: filtered supplier table + per-category FAQ accordion (9 categories) |
| `/submit-review` | Review form (star ratings, service selector, honeypot); reads `?company=` to preselect |
| `/list-your-company` | Public supplier-apply form (Turnstile + rate-limited + validated) |
| `/contact` | Contact form (general / update-profile toggle, honeypot) |
| `/blog`, `/blog/[slug]` | **Temporarily hidden** (noindex + unlinked + out of sitemap, pending content-team review — see Gotchas). Pages still render at their URLs. |
| `/privacy`, `/terms`, `/thank-you`, `/verify-submission`, `/404` | Static utility pages |

**SSR API (`prerender = false`):** `/api/review`, `/api/contact`, `/api/list-company`, `/api/verify-submission`, plus `/api/admin/*` (login + reviews/submissions/companies CRUD; all gated by `requireAdmin`).

**Admin (magic-link, `prerender = false`):** `/admin` (dashboard), `/admin/login`, `/admin/auth/callback`, `/admin/companies` (+ `[slug]` editor, `new`), `/admin/reviews` (+ `[id]` detail/moderation), `/admin/submissions` (+ `[id]` detail/approval).

## Schema.org Markup

| Page | Schema Types |
|------|-------------|
| Homepage | WebSite, Organization, ItemList |
| Company Profile | LocalBusiness, AggregateRating (**first-party approved reviews only**), FAQPage, Service, Review |
| Services Index | ItemList (services), ItemList (suppliers), BreadcrumbList |
| Service Category | ItemList, Service, FAQPage, BreadcrumbList |
| Blog (when live) | Blog, BlogPosting |

**Hard rule:** Google Business Profile ratings are displayed as *attributed third-party* data on profiles only — **never** emitted in any JSON-LD and never in the ranked tables. Only first-party approved reviews feed `AggregateRating`. All JSON-LD is escaped via `safeJsonLd()` (`src/lib/jsonld.ts`).

## Database Schema (Supabase)

**Project:** `kitchen-directory` (ca-central-1) · **ID:** `awksvtteuzrzwazqxxyi` · **URL:** https://awksvtteuzrzwazqxxyi.supabase.co

**Tables:**
- `companies` — name, slug (immutable), description, address (jsonb), `ranking_score` (trigger-computed), `ranking_breakdown` (jsonb), `services` (text[], **display names**), `certifications` (text[]), `partners` (jsonb[]), `logo_url`, `card_blurb`, `faq` (jsonb[]), `is_featured`, `deleted_at` (soft-delete), `google_place_id` / `google_rating` / `google_review_count` / `google_rating_as_of` / `google_place_url`
- `service_categories` — name, slug, description, `card_blurb`, `faq` (jsonb) — 9 categories seeded
- `reviews` — company_id (FK), reviewer_name, rating (1-5), service_category, custom_service, review_text, status (pending/approved/rejected), `internal_notes`, `updated_at`
- `supplier_submissions` — the public-apply funnel; status (unverified/pending/needs_info/approved/rejected), services as **slugs**, certifications, `internal_notes`
- `contact_submissions` — type (general/update_profile), name, email, company_name, message
- `blog_posts` — title, slug, body (markdown), excerpt, featured_image_url, author, category, linked_companies[], meta_*, status, published_at

**Key functions / triggers:**
- `compute_ranking_score` (BEFORE INSERT/UPDATE on companies) — weighted average from `ranking_breakdown`
- `approve_submission(uuid)` — atomic, idempotent submission→company promotion; **maps service slugs → display names** via `service_categories`, carries certifications, generates a unique slug
- `is_admin()` (SECURITY DEFINER, reads Vault `admin_emails`) — RLS gate for `supplier_submissions`
- Deploy-hook triggers fire `fire_deploy_hook()` → pg_net POST to the Vercel deploy hook (URL in Supabase Vault as `vercel_deploy_hook`): `trg_company_changed` (company insert/update/delete), `trg_review_approved` (review → approved), `trg_review_deleted` + `trg_review_unpublished` (approved review removed/unpublished — rebuild drops it)
- Vault-reading notify/helper functions are all `SECURITY DEFINER` with pinned `search_path`, EXECUTE revoked from anon/authenticated/public (migration 007 hardening)

**RLS:** companies/service_categories/blog_posts public SELECT (companies scoped `deleted_at is null`, blog `status='published'`); reviews public SELECT (approved) + INSERT (`status='pending'` only); contact_submissions INSERT only; supplier_submissions INSERT (`unverified` entry state only) + admin-only SELECT/UPDATE via `is_admin()`. Public signup is **disabled** (`disable_signup:true`).

**Migrations:** `supabase/migrations/001`→`017`. Applied to prod via Supabase MCP (forward-only). Latent: duplicate `005_*`/`006_*` numbers exist (left as-is). After pulling, apply any un-applied migration via MCP / dashboard SQL editor.

## Companies & Ranking
- **~49 active companies** (launched with 7; expanded to ≥10 real, verified suppliers under every `/services/` category — **except Price Match, kept truthfully at 7**; don't pad it). Every company has a real self-hosted logo (`public/logos/<slug>.png|svg`).
- **Invariant: Shop at Stop is always #1 (9.4).** Top competitor is Russell Hendrix (7.7). Every competitor's composite must stay `< 9.4`.
- **Ranking = 6 weighted criteria** editorially assigned per company: Service Range (20%), Customer Reviews (25%), Industry Experience (20%), Response Time (15%), Pricing Transparency (10%), Certifications (10%). Composite auto-computed by the DB trigger — admin edits `ranking_breakdown`, `ranking_score` follows.
- **Restaurant Consulting + Account Management sit at exactly 10** — add a replacement before removing any company tagged with those.
- Adding suppliers: edit `COMPANIES` / `LOGO_FILES` in `scripts/build-companies-seed.cjs`, regenerate, apply via MCP; tag services **exactly** as `service_categories.name`. Then run the image optimizer (below) for the new logo.

## Commands
```bash
npm run dev          # Dev server (http://localhost:4321)
npm run build        # Production build (SSG from Supabase)
npm test             # Vitest unit tests (113)
npm run test:e2e     # Playwright E2E (defaults to public prod alias; see e2e/README.md)
```
Local real-data build needs a gitignored `.env` (`PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`); fetch the anon key via Supabase MCP `get_publishable_keys` (project `awksvtteuzrzwazqxxyi`).

## Deployment
- **Vercel project:** kitchen-directory (roccos-projects-d33851a4) · **Prod URL:** kitchen-directory.vercel.app (→ kitchenequipment.ca after DNS)
- **GitHub:** TIA-Rocco/kitchen-directory (public) — auto-deploys on push to main, preview deploys on branches (**previews are SSO-gated** → run headless QA against the public prod alias)
- **Process:** `feat/*` branch → preview → merge to `main` → Vercel SSG build (~60-90s). Admin approval flows also trigger a rebuild via the pg_net deploy-hook triggers above.

## Environment Variables (Vercel)
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_SITE_URL` — origin for admin magic-link callbacks (currently `https://kitchen-directory.vercel.app`; update at DNS cutover). **Inlined by Astro at build time → redeploy after changing.**
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` (`kitchenequipment.ca`) — Mailgun edge-function secret still unset; email delivery latent (non-blocking, submissions auto-verify)
- `ADMIN_EMAILS` — comma-separated allow-list for admin magic-link sign-in

## Admin Auth (magic link)
- `/admin/login` → `/api/admin/login` calls `signInWithOtp({ shouldCreateUser:false, options:{ emailRedirectTo } })`. Callback built from `PUBLIC_SITE_URL` (fallback `url.origin`) → `/admin/auth/callback?next=…`.
- Admins must be **pre-provisioned** in `auth.users` (`shouldCreateUser:false`). Emails not in `ADMIN_EMAILS` are silently no-op'd (anti-enumeration).
- **Supabase Auth → URL Configuration** must allow-list every callback host under **Redirect URLs**, else Supabase rewrites the link to the Site URL and the PKCE `code` lands at `/` with nothing to exchange. Current entries: `https://kitchen-directory.vercel.app/admin/auth/callback`, `https://kitchen-directory.vercel.app/**`, `http://localhost:4321/admin/auth/callback`. Site URL: `https://kitchen-directory.vercel.app` (update at DNS cutover).
- For production email volume, plug **Mailgun SMTP** into Auth → SMTP Settings (the default shared SMTP caps ~2/hr).

## Team
- **Design + Dev:** Claude Code (AI-assisted) · **SEO & Content:** Alethea + Darcy · **Approvals:** Luke (rankings, competitor list) · **Review moderation:** Sonia · **Domain/DNS:** kitchenequipment.ca (registered)

---

## Conventions & Gotchas (active — read before editing)

- **Shared nav: edit `src/components/Header.astro` ONCE.** Every public page uses `<Header />` (hamburger mobile nav + Services dropdown + Contact-Us-in-dropdown). **Do not reintroduce per-page inline `<header>`.**
- **Admin endpoints: gate with `requireAdmin(locals)`** from `src/lib/admin-auth.ts` (returns 401/403 or the `User`), not a bare `locals.user` check. `isAdminEmail()` is the single allow-list source of truth (shared by middleware + handlers).
- **JSON-LD: always emit via `safeJsonLd()`** (`src/lib/jsonld.ts`) — escapes `<`/`>`/`&`/U+2028/U+2029 to prevent `</script>` breakout (stored-XSS fix SEC-03).
- **`@astrojs/compiler` tokenizer quirk:** its frontmatter scanner mis-parses `Math.round(... / ...)` division sequences nested in `getStaticPaths`, emitting a bogus "Unexpected export". Keep such arithmetic in plain `.ts` helpers (`src/lib/reviews.ts`, `googleRating.ts`, `heroImage.ts`), not in `.astro` frontmatter.
- **Service names vs slugs:** `companies.services` + the admin editor + `/services/[slug]` filtering + the review form all key off **display names** (`Restaurant Consulting`). The apply funnel stores **slugs** (`restaurant-consulting`). `approve_submission()` does the slug→name mapping — preserve it.
- **Google ratings:** attributed third-party display, **profile pages only**. Never in JSON-LD, never in ranked tables. Stored as a dated snapshot (`google_rating_as_of`). Refresh is **quarterly + manual** via `scripts/fetch-google-ratings.cjs` (review the generated SQL + low-confidence report → apply). Admin can hand-correct via the company editor. Asana reminder exists (first due 2026-09-04).
- **Hero images:** rendered via `HeroImage.astro` (`<picture>` AVIF→WebP→JPG) with an LCP `<link rel=preload>`. Source JPGs in `public/heroes/`; optimized variants under `opt/` (generated, committed). Source full-res PNGs live on the Desktop (`~/Desktop/kitchen-directory-heroes/`), **not** in the repo. Higgsfield gotcha: never say "brand accent" (→ invented signage) — use "colour accent only" + no-text/no-signage negatives; wrap generations in a retry loop (transient 502/504).
- **Image optimization (`scripts/optimize-images.cjs`, run locally, output committed):** after **adding a company** drop its logo at `public/logos/<slug>.png` then run `node scripts/optimize-images.cjs --logos-only`. After **adding a service** add `public/heroes/services/<slug>.jpg` then re-run, or the hero `<picture>` 404s.
- **Blog is temporarily hidden** (PR #59): `noindex` on `/blog` + `/blog/[slug]` (via `Base.astro` `noindex` prop), removed from `Header.astro` nav, and filtered out of the sitemap in `astro.config.mjs`. Pages still render at their URLs (for content-team review). **To re-enable:** remove the two `noindex` props, restore both Blog nav links, drop the sitemap `filter`, redeploy. (Tracked in `project_blog_temporarily_hidden` memory.)
- **Mandatory post-merge QA:** when a PR touches templates/components/styles, run agent-browser visual QA at 1280×800 + 375×812 against the **public prod alias** (previews are SSO-gated). Watch the daemon-pollution gotcha: a concurrent local `npm run dev` + the `e2e-on-large-change` Stop-hook can hijack the shared agent-browser tab — `agent-browser close --all` then re-open, or curl the SSG HTML.
- **Deploy-hook double-fire (P3, accepted):** an admin action that both updates a company and changes status can fire two deploy hooks → one harmless extra rebuild.

## Active backlog — Security hardening (post-launch, non-blocking)
From the 2026-06-01 audit. All four launch-blockers (SEC-01/02/03/06) are fixed + verified live; these remain:

1. **SEC-04 — Security headers (`vercel.json`).** Only HSTS today. Add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a CSP (start `Content-Security-Policy-Report-Only`, then enforce). CSP must allow: `connect-src` → `https://awksvtteuzrzwazqxxyi.supabase.co`; `script-src`/`frame-src` → Cloudflare Turnstile (`https://challenges.cloudflare.com`) + Vercel analytics (`https://va.vercel-scripts.com`). Fonts are now same-origin (`'self'`) — no `rsms.me` needed.
2. **SEC-05 — Rate-limit + Turnstile on `/api/review` & `/api/contact`.** Honeypot-only today. Each review insert can fire an admin email → **email-bomb / Mailgun-quota vector once the Mailgun secret is set**. Mirror `list-company.ts`: Turnstile (`verifyTurnstile`/`parseTurnstileResponse` in `src/lib/validation.ts`), per-IP limit (~5/10 min via `getClientIp` + service-role count), length caps (names ≤120, bodies ≤5000).
3. **SEC-08/09 — Postgres hardening (one migration).** `alter function … set search_path = public` on the 6 flagged funcs (`compute_ranking_score`, `update_updated_at`, `promote_submission`, `purge_unverified_submissions`, `generate_unique_company_slug`, `notify_blog_post_published`). Move `pg_net` out of the `public` schema. Re-run Supabase security advisors to confirm.
4. **SEC-10 — Logo upload magic-byte check** in `src/pages/api/list-company.ts`: sniff PNG (`89 50 4E 47`) / JPEG (`FF D8 FF`) before upload instead of trusting the client MIME (keep the size + SVG-exclusion checks).

**Edge Function deploy note (SEC, PR #39):** `send-transactional-email` now refuses unauthenticated calls when `EDGE_SHARED_SECRET` is unset on a hosted deploy (closes the open-relay). Edge functions don't deploy via git — this takes effect only on the next `supabase functions deploy send-transactional-email`, after which the hosted function refuses **all** calls until `EDGE_SHARED_SECRET` is set. So **set that secret before/with the deploy** (relevant when wiring up Mailgun for SEC-05).

*Informational (no action): GraphQL anon/authenticated advisors are metadata-discoverability only — row data is RLS-protected (verified). `auth_leaked_password_protection` is N/A (magic-link only).*

---

## Changelog
One line per session. Full write-ups: [`docs/SESSION-LOG.md`](docs/SESSION-LOG.md). Exact diffs: git history / linked PRs.

| Date | PR | Summary |
|------|-----|---------|
| 2026-04-08 | — | Initial build: Astro 5 + Tailwind 4 + Supabase + Vercel scaffold; 11 page templates; 2 API endpoints; schema (4 tables, 3 triggers, RLS); Mailgun edge fn; 7 seeded companies; 20 unit tests |
| 2026-04-30 | partners-blog | Brand Partners on profiles (migration 003); blog system (004, `/blog` + `/blog/[slug]`, markdown via `marked`+DOMPurify); Rating Breakdown tooltip (`InfoTooltip.astro`) |
| 2026-05-29 | remaining-dev-tasks | Review-submit 500 fix (007 SECURITY DEFINER vault funcs); submission pipeline auto-verify + `approve_submission()` (008); company management + soft-delete (009/011); landing redesign (010); 8 blog posts + 9 category descriptions |
| 2026-05-30 | #18 | Services dropdown icons + new `/services` index page (master supplier table) |
| 2026-06-01→03 | #22 | Pre-launch security audit + fixes: `safeJsonLd()` XSS (SEC-03), RLS hardening (013), public signup disabled (SEC-01) |
| 2026-06-03 | #24 | Playwright E2E suite (`e2e/`, 178 tests); self-hosted Inter font (CORS fix); star-rating a11y fix |
| 2026-06-03 | #25 | Submission service slug→name mapping + certifications end-to-end (014); copy fixes |
| 2026-06-03 | #29/#30/#31 | Real review stars/counts on `/services` tables; review moderation pipeline + detail page (015); dropped standalone numeric avg |
| 2026-06-03 | #32/#34/#35/#36 | +44 verified suppliers → ≥10 per category (Price Match kept at 7); real self-hosted logos; removed 2 logoless companies (→49 active) |
| 2026-06-04 | #38/#39/#40 | Repo hygiene (backfilled #29-31 log, branch/worktree sweep); recovered edge-fn open-relay guard (#39) |
| 2026-06-04 | #43 | Higgsfield photo heroes on homepage + service pages (per-banner crop anchors) |
| 2026-06-04 | #44 | Mobile hamburger nav in `Header.astro` |
| 2026-06-04 | #42/#47 | Attributed Google rating badge on profiles (016, profile-only, never in JSON-LD); CTA → "Read all N reviews on Google" |
| 2026-06-04 | #49 | Image perf: `optimize-images.cjs` + `HeroImage` `<picture>`/preload → mobile PageSpeed 83→94/95/96 |
| 2026-06-04 | #53 | Deep-link company-profile "Write a Review" CTAs (`?company=slug`) |
| 2026-06-04 | #55 | Site-wide shared `<Header />` (10 pages de-duped) + Contact-Us-in-dropdown; admin hard-delete reviews (017) |
| 2026-06-04 | #57 | `requireAdmin()` defense-in-depth across all 14 `/api/admin/*` handlers (`src/lib/admin-auth.ts`) |
| 2026-06-04 | #59 | Temporarily hide blog (noindex + removed from nav + dropped from sitemap; re-enable steps in Gotchas) |
| 2026-06-05 | #62 | SEO pre-launch audit: canonical/og/sitemap/JSON-LD repointed vercel.app→`www.kitchenequipment.ca`; trailing-slash align (canonical==JSON-LD `@id`); company `BreadcrumbList`; Org logo→`/brand/logo.svg`; robots.txt + admin out of sitemap. Plus infra (not in repo): vercel.app alias 308→www, `PUBLIC_SITE_URL`→www |
| 2026-06-05 | #63 | SEO polish: `noindex` `/thank-you` + `/verify-submission` (+ sitemap exclusion); per-page sitemap `<lastmod>` from `companies.updated_at` (built in `astro.config.mjs`); security headers via new `vercel.json` (XFO/XCTO/Referrer/Permissions + CSP **Report-Only**) |
| 2026-06-05 | #65 | Reveal-on-scroll-up sticky header (`Header.astro`): `relative`→`sticky top-0 z-50` + animated `transition-transform`; hides on scroll-down, slides back in on scroll-up; rAF-throttled passive listener, 6px intent threshold; guards (80px top, open-menu `aria-expanded`, focus-within); `prefers-reduced-motion` → plain pinned header |
