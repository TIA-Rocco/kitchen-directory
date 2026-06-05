// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Canonical production origin. Drives <link rel="canonical">, og:url, and the
  // sitemap <loc> URLs. MUST match the live primary domain — Vercel redirects
  // apex + http + www-http → https://www.kitchenequipment.ca, so www is the
  // canonical host. (Was the Vercel preview alias pre-launch.)
  site: 'https://www.kitchenequipment.ca',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel({
    imageService: true,
  }),
  integrations: [
    sitemap({
      // Keep non-public surfaces out of the sitemap:
      // - /blog/* — temporarily hidden (noindexed + unlinked) pending content-team
      //   review; listing them would conflict with their noindex directive.
      // - /admin/* — authenticated admin panel (also noindexed via Admin.astro);
      //   never advertise these URLs to crawlers.
      filter: (page) => !/\/(blog|admin)(\/|$)/.test(page),
    }),
  ],
  image: {
    domains: ['awksvtteuzrzwazqxxyi.supabase.co'],
  },
});
