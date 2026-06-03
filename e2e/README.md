# Kitchen Directory — Playwright E2E Suite

End-to-end coverage for **kitchenequipment.ca**, targeting the live production
deployment (`https://kitchen-directory.vercel.app`) by default. Vercel **preview**
deploys are SSO-gated, so headless QA must hit the public prod alias.

```bash
npm run test:e2e            # full suite
npm run test:e2e:public    # public pages only (read-only, safe)
npm run test:e2e:forms     # form behaviour + validation
npm run test:e2e:admin     # authenticated admin flows (needs creds — see below)
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:report    # open the last HTML report

BASE_URL=http://localhost:4321 npm run test:e2e   # retarget (e.g. local dev)
```

## What's covered

| Area | File | Notes |
|------|------|-------|
| Homepage | `public/homepage.spec.ts` | hero, CTAs, service grid, top-5 ranking, Top Rated badge, WebSite/Organization/ItemList JSON-LD |
| Company profiles | `public/company-profile.spec.ts` | all 7 companies — rating breakdown, services→slug integrity, FAQ counts, LocalBusiness/Review/FAQPage schema, info-tooltip a11y, brand partners, 404 |
| Service pages | `public/services.spec.ts` | all 9 categories — ItemList/Service/BreadcrumbList schema, FAQ accordion, 404 |
| Blog | `public/blog.spec.ts` | index + all 9 posts, BlogPosting schema, **markdown sanitization**, 404 |
| Static pages | `public/static-pages.spec.ts` | privacy, terms, thank-you, real 404 status |
| SEO | `public/seo-schema.spec.ts` | robots.txt, sitemap, canonical, OG/Twitter, site-wide JSON-LD validity |
| Accessibility | `public/accessibility.spec.ts` | axe-core WCAG 2.1 A/AA (critical+serious), labels, alt text, keyboard |
| Responsive | `public/responsive.spec.ts` | 375×812 + 1280×800, no horizontal overflow, nav adaptation |
| Review form | `forms/submit-review.spec.ts` | render, preselect, native + server validation, honeypot, **real insert** |
| Contact form | `forms/contact.spec.ts` | reason toggle, `submit_company` interception, validation, honeypot, **real insert** |
| Apply wizard | `forms/list-your-company.spec.ts` | 4-step nav, per-step validation, honeypot, Turnstile bot-gate enforcement |
| Verify submission | `forms/verify-submission.spec.ts` | token endpoint (invalid/missing); valid-token path is env-gated |
| Admin gate | `admin/admin-auth.spec.ts` | unauth redirects, 401 APIs, login page, anti-enumeration |
| Admin flows | `admin/authenticated/admin-flows.spec.ts` | dashboard, queues, company edit, ranking preview, **public-submit→admin-reject loop** |

## Test data hits the real database

The chosen strategy is **real inserts, tagged for cleanup**. Happy-path review
and contact submissions land as `pending`/unmoderated rows (never publicly
visible) stamped with the marker `[[KE-E2E]]` and a `KE-E2E …` name.

**Run this after a suite run to remove them** (via the Supabase SQL editor / MCP):

```sql
delete from reviews
  where review_text like '%[[KE-E2E]]%' or reviewer_name like 'KE-E2E %';

delete from contact_submissions
  where message like '%[[KE-E2E]]%' or name like 'KE-E2E %';

-- Supplier submissions are Turnstile-blocked in prod so none should be created,
-- but clean defensively just in case the gate is ever disabled:
delete from supplier_submissions
  where business_email like '%business-example.com' or name ilike 'E2E %';
```

The admin end-to-end loop creates one review and immediately **rejects** it (so
it is never published); the cleanup above also removes it.

## Enabling the optional specs

Authenticated admin flows and the valid-token verify test need credentials.
Copy `.env.e2e.example` and export the vars (or pass inline). The suite uses
`e2e/auth.setup.ts` to mint a real Supabase session and store it as Playwright
state — no email round-trip needed.

- **Admin flows** — set `SUPABASE_SERVICE_ROLE_KEY` (+ `E2E_ADMIN_EMAIL`, an
  allow-listed admin) **or** `E2E_ADMIN_PASSWORD`. Without either, the admin-flow
  specs self-skip (the gate tests in `admin-auth.spec.ts` still run).
- **Valid verify token** — seed an `unverified` `supplier_submissions` row with a
  known `verification_token`, then set `E2E_VERIFY_TOKEN`.

## Findings surfaced by this suite (against prod, 2026-06-01)

Real issues the suite caught while being built.

1. **✅ FIXED — Brand font failed to load in production (CORS).** `InterVariable.woff2`
   was loaded from `rsms.me`, which sends no `Access-Control-Allow-Origin` header, so
   Chrome blocked it and the site silently fell back to system fonts. **Fix:** self-hosted
   the Inter variable font under `public/fonts/` with local `@font-face` rules in
   `src/styles/global.css` + a `<link rel="preload">` in `Base.astro`. The console-error
   filter no longer ignores `rsms.me`, so a regression is caught. *(Deploy required: the
   live site shows the fix only after this branch ships.)*
2. **✅ FIXED — Critical a11y: star-rating radios had no accessible name** (`/submit-review`).
   The 5 `input[type=radio][name=rating]` were wrapped in `<label>`s containing only an
   SVG star. **Fix:** added `aria-label="1 star"…"5 stars"` per radio and wrapped them in a
   `role="radiogroup"` labelled by the "Rating" text. The accessibility gate's
   `KNOWN_CRITICALS` baseline is now empty (enforces zero criticals everywhere).
   *(Deploy required.)*
3. **Serious a11y: colour-contrast** on muted `neutral-400` text across pages
   (scores `/10`, helper text). Reported as non-blocking annotations — see the axe
   warnings in the run output / HTML report.
4. **Edge blocks cross-origin POSTs (403).** Production rejects `POST`s to the API
   routes that lack `Origin`/`Sec-Fetch-Site` headers (a CSRF/bot heuristic) before
   the app runs. Real browser forms send these implicitly; our API tests replicate
   them via `apiHeaders()`. Good posture — just note it if you ever script the API.
5. **`/contact` offers a "List My Company" reason the API rejects (400).** The
   `submit_company` option is intercepted client-side (redirected to the dedicated
   form), but a no-JS POST returns `Please choose a valid reason for contact.` Covered
   by `contact.spec.ts`.
6. **Live data drift.** The active-company roster grew from 7→8 mid-build, so
   company-count/order assertions use invariants (descending score, featured-first,
   schema self-consistency, known-subset present) rather than hard-coded counts.

## Config notes

- `playwright.config.ts` — prod baseURL, 1280×800 desktop, 1 retry locally,
  `trace: on-first-retry`, `video/screenshot` on failure, HTML + list reporters.
- Projects: `setup` (auth) → `admin` (authenticated, storage state); everything
  else runs in `chromium`.
- Console-error assertions ignore third-party noise (analytics, Cloudflare,
  external logo/font CDNs) — see `IGNORED_ERROR_PATTERNS` in `fixtures.ts`.
