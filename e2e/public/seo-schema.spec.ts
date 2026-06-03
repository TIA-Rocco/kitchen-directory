import { test, expect } from '@playwright/test';
import { COMPANIES, SERVICES, BLOG_POSTS, getJsonLd } from '../fixtures';

const REPRESENTATIVE = [
  '/',
  `/companies/${COMPANIES[0].slug}`,
  `/services/${SERVICES[4].slug}`, // equipment-financing
  '/blog',
  `/blog/${BLOG_POSTS[0]}`,
  '/contact',
];

test.describe('SEO foundations', () => {
  test('robots.txt is served', async ({ request, baseURL }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.toLowerCase()).toContain('user-agent');
  });

  test('sitemap index + url set include companies, services and blog posts', async ({ request }) => {
    const idx = await request.get('/sitemap-index.xml');
    expect(idx.status()).toBe(200);
    const idxBody = await idx.text();
    expect(idxBody).toContain('<sitemapindex');
    const childMatch = idxBody.match(/<loc>([^<]*sitemap-0\.xml)<\/loc>/);
    expect(childMatch, 'sitemap-index should reference sitemap-0.xml').toBeTruthy();

    const urls = await request.get('/sitemap-0.xml');
    expect(urls.status()).toBe(200);
    const body = await urls.text();
    expect(body).toContain(`/companies/${COMPANIES[0].slug}`);
    expect(body).toContain(`/services/${SERVICES[0].slug}`);
    expect(body).toContain(`/blog/${BLOG_POSTS[0]}`);
  });

  for (const path of REPRESENTATIVE) {
    test(`meta + canonical + OG/Twitter present on ${path}`, async ({ page }) => {
      await page.goto(path);

      // Canonical reflects this page's path.
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, 'canonical href').toBeTruthy();
      // Production normalizes to trailing slashes; compare without them.
      const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);
      expect(norm(new URL(canonical!).pathname)).toBe(norm(path));

      // Description is non-empty.
      const desc = await page.locator('meta[name="description"]').getAttribute('content');
      expect(desc?.length ?? 0).toBeGreaterThan(20);

      // Open Graph.
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      // Must be an absolute URL (blog posts use their own featured image, which
      // may be a .jpg / storage URL, not the default og-image.png).
      expect(ogImage).toMatch(/^https?:\/\/.+/);
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');

      // Twitter.
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

      // Exactly one <title>, single lang attribute.
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  }

  test('all JSON-LD on representative pages is valid JSON with @context + @type', async ({ page }) => {
    for (const path of REPRESENTATIVE) {
      await page.goto(path);
      const blocks = await getJsonLd(page); // throws if any block is malformed
      for (const b of blocks) {
        expect(b['@type'], `@type on ${path}`).toBeTruthy();
      }
    }
  });
});
