// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://www.kitchenequipment.ca';

// --- Sitemap <lastmod> -------------------------------------------------------
// Build a URL → lastmod (ISO 8601) map from company data so the sitemap carries
// trustworthy per-page lastmod (crawlers discount uniform/build-time lastmod).
// Company pages get their own companies.updated_at; every other page (homepage,
// /services, /services/<slug>, static pages) falls back to the freshest company
// timestamp — those pages render the company tables, so the latest company edit
// is their effective last-modified, and the whole SSG site rebuilds on any
// company change via the deploy-hook trigger.
//
// Defensive by design: a missing env var or unreachable DB at build time must
// NEVER fail the build — we just ship the sitemap without lastmod.
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'PUBLIC_');
const SUPABASE_URL = env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

/** @type {Record<string, string>} */
const lastmodByUrl = {};
/** @type {string | undefined} */
let siteLastmod;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb
      .from('companies')
      .select('slug, updated_at')
      .is('deleted_at', null);
    for (const c of data ?? []) {
      if (!c.updated_at) continue;
      const iso = new Date(c.updated_at).toISOString();
      lastmodByUrl[`${SITE}/companies/${c.slug}/`] = iso;
      if (!siteLastmod || iso > siteLastmod) siteLastmod = iso;
    }
  }
} catch (err) {
  console.warn('[sitemap] lastmod map skipped (non-fatal):', err?.message ?? err);
}

export default defineConfig({
  // Canonical production origin. Drives <link rel="canonical">, og:url, and the
  // sitemap <loc> URLs. MUST match the live primary domain — Vercel redirects
  // apex + http + www-http → https://www.kitchenequipment.ca, so www is the
  // canonical host. (Was the Vercel preview alias pre-launch.)
  site: SITE,
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel({
    imageService: true,
  }),
  integrations: [
    sitemap({
      // Keep non-public / non-indexable surfaces out of the sitemap:
      // - /admin/* — authenticated admin panel (also noindexed via Admin.astro).
      // - /thank-you, /verify-submission — thin post-action pages (noindexed); no search value.
      filter: (page) => !/\/(admin|thank-you|verify-submission)(\/|$)/.test(page),
      // Attach trustworthy per-page lastmod from the company-data map above.
      serialize(item) {
        const lastmod = lastmodByUrl[item.url] ?? siteLastmod;
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
  image: {
    domains: ['awksvtteuzrzwazqxxyi.supabase.co'],
  },
});
