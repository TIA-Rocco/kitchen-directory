import { test, expect } from '@playwright/test';
import {
  COMPANIES,
  FEATURED,
  SERVICES,
  getJsonLd,
  findByType,
  allByType,
  trackPageErrors,
  filterAppErrors,
  expectSingleH1,
} from '../fixtures';

const RANKING_LABELS = [
  'Service Range',
  'Customer Reviews',
  'Industry Experience',
  'Response Time',
  'Pricing Transparency',
  'Certifications',
];
const SERVICE_SLUGS = new Set(SERVICES.map((s) => s.slug));

test.describe('Company profile pages', () => {
  for (const company of COMPANIES) {
    test.describe(company.slug, () => {
      test('renders core structure (h1, breadcrumb, title, no console errors)', async ({ page }) => {
        const tracker = trackPageErrors(page);
        await page.goto(`/companies/${company.slug}/`);

        await expect(page).toHaveTitle(new RegExp(`${escapeRe(company.name)} - Commercial Kitchen Equipment`));
        const h1 = await expectSingleH1(page);
        expect(h1).toBe(company.name);

        const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
        await expect(crumb.getByRole('link', { name: 'Home' })).toBeVisible();
        await expect(crumb).toContainText('Companies');
        await expect(crumb).toContainText(company.name);

        expect(filterAppErrors(tracker.errors), tracker.errors.join('\n')).toEqual([]);
      });

      test('rating breakdown shows the score and all 6 weighted criteria', async ({ page }) => {
        await page.goto(`/companies/${company.slug}/`);
        const section = page.locator('section', { has: page.getByRole('heading', { name: 'Rating Breakdown' }) });

        await expect(section.getByText('out of 10')).toBeVisible();
        await expect(section).toContainText(String(company.score));

        // Each criterion label appears in the breakdown (also echoed in the
        // tooltip, so assert presence rather than a single visible node).
        for (const label of RANKING_LABELS) {
          await expect(section).toContainText(label);
        }
        // Exactly 6 weighted-criteria bars are rendered.
        await expect(section.locator('div.h-2.rounded-full')).toHaveCount(6);
      });

      test('every "Services Offered" link resolves to a real service category slug', async ({ page }) => {
        await page.goto(`/companies/${company.slug}/`);
        const section = page.locator('section', { has: page.getByRole('heading', { name: 'Services Offered' }) });
        const hrefs = await section.locator('a[href^="/services/"]').evaluateAll((els) =>
          els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || ''),
        );
        expect(hrefs.length, 'company should list at least one service').toBeGreaterThan(0);
        for (const href of hrefs) {
          const slug = href.replace('/services/', '');
          expect(SERVICE_SLUGS, `derived service slug "${slug}" must exist`).toContain(slug);
        }
      });

      test('FAQ section renders the expected number of Q&A pairs', async ({ page }) => {
        await page.goto(`/companies/${company.slug}/`);
        const faq = page.locator('section', { has: page.getByRole('heading', { name: 'Frequently Asked Questions' }) });
        await expect(faq.locator('dt')).toHaveCount(company.faq);
        await expect(faq.locator('dd')).toHaveCount(company.faq);
      });

      test('contact sidebar shows address and a Write a Review CTA', async ({ page }) => {
        await page.goto(`/companies/${company.slug}/`);
        const aside = page.locator('aside');
        await expect(aside.getByRole('heading', { name: 'Contact Information' })).toBeVisible();
        await expect(aside.getByText('Address', { exact: true })).toBeVisible();
        await expect(aside.getByRole('link', { name: 'Write a Review' })).toHaveAttribute('href', '/submit-review');
      });

      test('LocalBusiness JSON-LD is present and consistent with visible reviews', async ({ page }) => {
        await page.goto(`/companies/${company.slug}/`);
        const blocks = await getJsonLd(page);

        const lb = findByType(blocks, 'LocalBusiness');
        expect(lb, 'LocalBusiness schema').toBeTruthy();
        expect(lb!.name).toBe(company.name);
        expect(lb!['@id']).toBe(`https://www.kitchenequipment.ca/companies/${company.slug}/`);
        expect((lb!.address as any)['@type']).toBe('PostalAddress');
        expect((lb!.address as any).addressCountry).toBe('CA');

        // Service schema per listed service.
        expect(allByType(blocks, 'Service').length).toBeGreaterThan(0);

        // aggregateRating must mirror the on-page review count.
        const reviewCountText = await page
          .locator('section', { has: page.getByRole('heading', { name: 'Rating Breakdown' }) })
          .textContent();
        const m = reviewCountText?.match(/\((\d+) reviews?\)/);
        const visibleReviews = m ? Number(m[1]) : 0;
        if (visibleReviews > 0) {
          expect(lb!.aggregateRating, 'aggregateRating expected when reviews exist').toBeTruthy();
          expect((lb!.aggregateRating as any).reviewCount).toBe(visibleReviews);
          expect(allByType(blocks, 'Review').length).toBe(visibleReviews);
        } else {
          expect(lb!.aggregateRating, 'no aggregateRating when there are no reviews').toBeUndefined();
        }

        // FAQPage emitted whenever the company has FAQs.
        if (company.faq > 0) {
          const faqLd = findByType(blocks, 'FAQPage');
          expect(faqLd).toBeTruthy();
          expect((faqLd!.mainEntity as any[]).length).toBe(company.faq);
        }
      });
    });
  }

  test('featured supplier shows Top Rated badge + Brand Partners + brand JSON-LD', async ({ page }) => {
    await page.goto(`/companies/${FEATURED.slug}`);
    await expect(page.getByText('Top Rated').first()).toBeVisible();

    const partners = page.locator('section', { has: page.getByRole('heading', { name: 'Brand Partners' }) });
    await expect(partners).toBeVisible();
    await expect(partners.locator('ul > li')).toHaveCount(FEATURED.partners);

    const blocks = await getJsonLd(page);
    const lb = findByType(blocks, 'LocalBusiness')!;
    expect(Array.isArray(lb.brand)).toBe(true);
    expect((lb.brand as any[]).length).toBe(FEATURED.partners);
    expect((lb.brand as any[])[0]['@type']).toBe('Brand');
  });

  test('non-featured supplier has no Top Rated badge and no Brand Partners section', async ({ page }) => {
    await page.goto('/companies/igloo-food-equipment');
    await expect(page.getByText('Top Rated')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Brand Partners' })).toHaveCount(0);
  });

  test.describe('Rating Breakdown info tooltip', () => {
    test('toggles on click and closes on Escape (keyboard accessible)', async ({ page }) => {
      await page.goto(`/companies/${FEATURED.slug}`);
      const trigger = page.getByRole('button', { name: 'How ratings are calculated' });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      // Panel content lists the weighting criteria.
      const panel = page.locator('[role="tooltip"]').first();
      await expect(panel).toContainText('Service Range');
      await expect(panel).toContainText('25%'); // Customer Reviews weight

      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  test('unknown company slug returns a 404', async ({ page }) => {
    const res = await page.goto('/companies/this-company-does-not-exist');
    expect(res?.status()).toBe(404);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
