import { test, expect } from '@playwright/test';
import {
  BLOG_POSTS,
  getJsonLd,
  findByType,
  trackPageErrors,
  filterAppErrors,
  expectSingleH1,
} from '../fixtures';

test.describe('Blog index', () => {
  test('lists all published posts with a Blog JSON-LD block', async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto('/blog');

    await expect(page).toHaveTitle(/Buying Guides & Industry Insights/);
    const h1 = await expectSingleH1(page);
    expect(h1).toContain('Buying Guides & Industry Insights');

    // Each known published post has a card linking to it.
    for (const slug of BLOG_POSTS) {
      await expect(page.locator(`a[href="/blog/${slug}"]`).first(), slug).toHaveCount(1);
    }

    const blocks = await getJsonLd(page);
    const blog = findByType(blocks, 'Blog');
    expect(blog, 'Blog schema').toBeTruthy();
    expect((blog!.blogPost as any[]).length).toBe(BLOG_POSTS.length);

    expect(filterAppErrors(tracker.errors), tracker.errors.join('\n')).toEqual([]);
  });
});

test.describe('Blog post pages', () => {
  for (const slug of BLOG_POSTS) {
    test(`${slug}: structure, sanitized body and BlogPosting schema`, async ({ page }) => {
      const tracker = trackPageErrors(page);
      await page.goto(`/blog/${slug}`);

      // Breadcrumb Home / Blog / {title}
      const blogCrumb = page.getByRole('link', { name: 'Blog' });
      await expect(blogCrumb.first()).toBeVisible();
      const h1 = await expectSingleH1(page);
      expect(h1.length).toBeGreaterThan(0);

      // Rendered markdown body present and NON-trivial.
      const prose = page.locator('.blog-prose');
      await expect(prose).toBeVisible();
      const proseText = (await prose.textContent())?.trim() ?? '';
      expect(proseText.length).toBeGreaterThan(200);

      // Sanitization: no inline <script> survived markdown rendering.
      await expect(prose.locator('script')).toHaveCount(0);

      // BlogPosting schema.
      const blocks = await getJsonLd(page);
      const posting = findByType(blocks, 'BlogPosting');
      expect(posting, 'BlogPosting schema').toBeTruthy();
      expect(posting!['@id']).toBe(`https://kitchenequipment.ca/blog/${slug}`);
      expect(posting!.headline).toBe(h1);
      expect(posting!.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect((posting!.author as any)['@type']).toBe('Organization');
      expect((posting!.publisher as any).name).toBe('Kitchen Equipment Canada');

      expect(filterAppErrors(tracker.errors), tracker.errors.join('\n')).toEqual([]);
    });
  }

  test('Featured Suppliers sidebar (when present) links to real company profiles', async ({ page }) => {
    // This guide explicitly compares suppliers, so it should have linked companies.
    await page.goto('/blog/best-commercial-kitchen-equipment-suppliers-toronto');
    const aside = page.locator('aside', { has: page.getByRole('heading', { name: 'Featured Suppliers' }) });
    if (!(await aside.count())) test.skip(true, 'post has no linked companies');

    const links = aside.locator('a[href^="/companies/"]');
    expect(await links.count()).toBeGreaterThan(0);

    const blocks = await getJsonLd(page);
    const posting = findByType(blocks, 'BlogPosting')!;
    expect(Array.isArray(posting.mentions)).toBe(true);
  });

  test('unknown blog slug returns a 404', async ({ page }) => {
    const res = await page.goto('/blog/no-such-post-exists');
    expect(res?.status()).toBe(404);
  });
});
