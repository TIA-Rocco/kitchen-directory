# Kitchen Directory - kitchenequipment.ca

## Project Overview
AEO-first commercial kitchen equipment supplier directory. Primary audience: AI engines and search crawlers.

## Tech Stack
- **Framework:** Astro 5 (static output, selective `prerender = false` for API routes)
- **Styling:** Tailwind 4
- **Database:** Supabase (Postgres)
- **Deployment:** Vercel
- **Email:** Mailgun (via Supabase Edge Function)
- **Tests:** Vitest (unit), Playwright (E2E, post-launch)

## Key Architecture Decisions
- All crawlable pages are SSG (pre-rendered at build time)
- Form endpoints use `export const prerender = false` for server-side handling
- JSON-LD structured data is the primary deliverable (Schema.org)
- Supabase dashboard serves as the admin panel (no custom admin)
- Ranking scores computed by Supabase DB trigger (single source of truth)
- Review approval triggers Vercel deploy hook via Supabase pg_net webhook

## Design Doc
Full design doc at: `~/.gstack/projects/KitchenDirectory/roccobombardieri-unknown-design-20260408-131227.md`

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm test         # Run Vitest unit tests
```

## Deployment
- **Vercel project:** kitchen-directory (roccos-projects-d33851a4)
- **Production URL:** kitchen-directory.vercel.app (will be kitchenequipment.ca after DNS)
- **Git integration:** TIA-Rocco/kitchen-directory on GitHub, auto-deploys on push to main
- **Branch previews:** Enabled for all branches

## Supabase
- **Project:** kitchen-directory (ca-central-1)
- **Project ID:** awksvtteuzrzwazqxxyi
- **URL:** https://awksvtteuzrzwazqxxyi.supabase.co
- **Dashboard:** Supabase dashboard is the admin panel (no custom admin UI)
- **Tables:** companies, service_categories, reviews, contact_submissions
- **Triggers:** ranking_score auto-computed from ranking_breakdown on insert/update
- **RLS:** Public read for companies/services/approved reviews, public insert for reviews/contacts

## Environment Variables (Vercel)
- PUBLIC_SUPABASE_URL
- PUBLIC_SUPABASE_ANON_KEY
- MAILGUN_API_KEY
- MAILGUN_DOMAIN

## Deploy Process
1. Push to `feat/*` branch for preview deploy
2. Merge to `main` for production deploy
3. Vercel auto-builds Astro SSG pages (~60-90s)
4. Review approval in Supabase triggers rebuild via deploy hook (TBD)
