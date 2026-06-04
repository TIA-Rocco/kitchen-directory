// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kitchen-directory.vercel.app',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel({
    imageService: true,
  }),
  integrations: [
    sitemap({
      // Blog is temporarily hidden (noindexed + unlinked) pending content-team
      // review — keep its URLs out of the sitemap so they aren't surfaced to
      // crawlers and don't conflict with the noindex directive.
      filter: (page) => !/\/blog(\/|$)/.test(page),
    }),
  ],
  image: {
    domains: ['your-supabase-project.supabase.co'],
  },
});
