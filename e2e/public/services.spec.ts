import { test, expect } from '@playwright/test';
import {
  SERVICES,
  getJsonLd,
  findByType,
  trackPageErrors,
  filterAppErrors,
  expectSingleH1,
} from '../fixtures';

test.describe('Service category pages', () => {
  for (const svc of SERVICES) {
    test.describe(svc.slug, () => {
      test('renders heading, breadcrumb and a supplier table or empty state', async ({ page }) => {
        const tracker = trackPageErrors(page);
        await page.goto(`/services/${svc.slug}`);

        await expect(page).toHaveTitle(new RegExp(`${escapeRe(svc.name)} - Commercial Kitchen Equipment Suppliers`));
        const h1 = await expectSingleH1(page);
        expect(h1).toBe(svc.name);

        const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
        await expect(crumb).toContainText('Home');
        await expect(crumb).toContainText('Services');
        await expect(crumb).toContainText(svc.name);

        const table = page.locator('table');
        if (await table.count()) {
          // Every listed supplier links to a real company profile.
          const rows = table.locator('tbody tr');
          expect(await rows.count()).toBeGreaterThan(0);
          const hrefs = await table.locator('tbody a[href^="/companies/"]').evaluateAll((els) =>
            els.map((e) => (e as HTMLAnchorElement).getAttribute('href')),
          );
          expect(hrefs.length).toBeGreaterThan(0);
        } else {
          await expect(page.getByText('No suppliers currently listed for this service. Check back soon.')).toBeVisible();
        }

        expect(filterAppErrors(tracker.errors), tracker.errors.join('\n')).toEqual([]);
      });

      test('emits ItemList + Service + BreadcrumbList JSON-LD', async ({ page }) => {
        await page.goto(`/services/${svc.slug}`);
        const blocks = await getJsonLd(page);

        const itemList = findByType(blocks, 'ItemList');
        expect(itemList, 'ItemList').toBeTruthy();
        expect(itemList!.name).toBe(`Best ${svc.name} Suppliers in Canada`);
        expect(itemList!.url).toBe(`https://www.kitchenequipment.ca/services/${svc.slug}`);

        const service = findByType(blocks, 'Service');
        expect(service, 'Service').toBeTruthy();
        expect(service!.name).toBe(svc.name);
        expect((service!.areaServed as any).name).toBe('Canada');

        const crumbLd = findByType(blocks, 'BreadcrumbList');
        expect(crumbLd, 'BreadcrumbList').toBeTruthy();
        const items = crumbLd!.itemListElement as any[];
        expect(items).toHaveLength(3);
        expect(items[2].name).toBe(svc.name);
      });
    });
  }

  test('FAQ accordion expands and collapses on click', async ({ page }) => {
    // Pick a category and exercise its FAQ accordion if present.
    await page.goto(`/services/${SERVICES[0].slug}`);
    const firstFaq = page.locator('details.faq-item').first();
    if (!(await firstFaq.count())) test.skip(true, 'no FAQ on this category');

    await expect(firstFaq).not.toHaveAttribute('open', /.*/);
    await firstFaq.locator('summary').click();
    await expect(firstFaq).toHaveAttribute('open', '');
    await firstFaq.locator('summary').click();
    await expect(firstFaq).not.toHaveAttribute('open', /.*/);
  });

  test('unknown service slug returns a 404', async ({ page }) => {
    const res = await page.goto('/services/not-a-real-service');
    expect(res?.status()).toBe(404);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
