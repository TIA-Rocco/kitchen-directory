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
