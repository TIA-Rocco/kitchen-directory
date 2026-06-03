import { test, expect } from '@playwright/test';
import { COMPANIES, SERVICES, BLOG_POSTS, expectNoHorizontalScroll } from '../fixtures';

const PAGES = [
  '/',
  `/companies/${COMPANIES[0].slug}`,
  `/services/${SERVICES[4].slug}`,
  '/blog',
  `/blog/${BLOG_POSTS[0]}`,
  '/submit-review',
  '/contact',
  '/list-your-company',
];

test.describe('Responsive — mobile (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of PAGES) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }

  test('primary nav collapses on the homepage (secondary links hidden, CTA visible)', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Blog' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Submit a Review' })).toBeHidden();
    await expect(header.getByRole('link', { name: 'Contact Us' })).toBeVisible();
  });

  test('decorative hero icon cluster is hidden on mobile', async ({ page }) => {
    await page.goto('/');
    // The icon grid is aria-hidden + max-lg:hidden.
    await expect(page.locator('[aria-hidden="true"] .size-7').first()).toBeHidden();
  });
});

test.describe('Responsive — desktop (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('full nav is visible on the homepage', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Submit a Review' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'List your company' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Contact Us' })).toBeVisible();
  });

  test('no horizontal overflow on key pages at desktop width', async ({ page }) => {
    for (const path of ['/', `/companies/${COMPANIES[0].slug}`, `/services/${SERVICES[0].slug}`]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  });
});
