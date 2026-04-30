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
  integrations: [sitemap()],
  image: {
    domains: ['your-supabase-project.supabase.co'],
  },
});
