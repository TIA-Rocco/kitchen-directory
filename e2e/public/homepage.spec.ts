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

test.describe('Homepage', () => {
  test('renders hero, title and meta without console errors', async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto('/');

    await expect(page).toHaveTitle(/Find Commercial Kitchen Equipment Suppliers in Canada \| Kitchen Equipment Canada/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Compare top-rated commercial kitchen equipment suppliers/,
    );
    const h1 = await expectSingleH1(page);
    expect(h1).toContain('Find the Best Commercial Kitchen Equipment Suppliers');

    expect(filterAppErrors(tracker.errors), tracker.errors.join('\n')).toEqual([]);
  });

  test('hero CTAs anchor to the right sections', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Browse top suppliers' })).toHaveAttribute('href', '#suppliers');
    await expect(page.getByRole('link', { name: 'Explore by service' })).toHaveAttribute('href', '#categories');

    await page.getByRole('link', { name: 'Browse top suppliers' }).click();
    await expect(page).toHaveURL(/#suppliers$/);
    await expect(page.locator('#suppliers')).toBeInViewport();
  });

  test('service category grid links to all 9 categories', async ({ page }) => {
    await page.goto('/');
    const grid = page.locator('#categories');
    await expect(grid.getByRole('heading', { name: 'Browse by service' })).toBeVisible();

    for (const svc of SERVICES) {
      const card = grid.locator(`a[href="/services/${svc.slug}"]`);
      await expect(card, `card for ${svc.slug}`).toHaveCount(1);
      await expect(card).toContainText(svc.name);
    }
    // Exactly 9 category cards.
    await expect(grid.locator('a[href^="/services/"]')).toHaveCount(SERVICES.length);
  });

  test('top-rated list shows 5 suppliers, score-descending, featured #1', async ({ page }) => {
    // Invariant-based (resilient to the exact roster, which changes in prod):
    // exactly 5 rows, scores non-increasing, the featured supplier ranked #1.
    await page.goto('/');
    const list = page.locator('#suppliers ul > li');
    await expect(list).toHaveCount(5);

    // First row is the featured supplier with its score.
    await expect(list.first()).toContainText(FEATURED.name);
    await expect(list.first()).toContainText(String(FEATURED.score));

    // Each row links to a company profile; scores descend.
    const scores: number[] = [];
    for (let i = 0; i < 5; i++) {
      const row = list.nth(i);
      await expect(row.locator('a[href^="/companies/"]')).toHaveCount(1);
      const text = (await row.textContent()) ?? '';
      const m = text.match(/(\d+(?:\.\d+)?)\s*\/10/);
      expect(m, `row ${i} should show a score`).toBeTruthy();
      scores.push(Number(m![1]));
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i], `scores must not increase (row ${i})`).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('only the featured supplier carries the "Top Rated" badge, ranked #1', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('#suppliers ul > li');
    // Exactly one ranked row carries the badge.
    await expect(items.filter({ hasText: 'Top Rated' })).toHaveCount(1);

    const firstRow = items.first();
    await expect(firstRow).toContainText(FEATURED.name);
    await expect(firstRow).toContainText('Top Rated');
  });

  test('"List your company" CTA is present and points to the application form', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('#suppliers').getByRole('link', { name: 'List your company' });
    await expect(cta).toHaveAttribute('href', '/list-your-company');
  });

  test('header + footer navigation are wired correctly', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    await expect(header.getByRole('link', { name: 'Submit a Review' })).toHaveAttribute('href', '/submit-review');
    await expect(header.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');

    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    await expect(footer.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  });

  test.describe('JSON-LD structured data (AEO deliverable)', () => {
    test('emits WebSite, Organization and ItemList', async ({ page }) => {
      await page.goto('/');
      const blocks = await getJsonLd(page);

      const website = findByType(blocks, 'WebSite');
      expect(website, 'WebSite schema').toBeTruthy();
      expect(website!.url).toBe('https://www.kitchenequipment.ca');

      const org = findByType(blocks, 'Organization');
      expect(org, 'Organization schema').toBeTruthy();
      expect(org!.name).toBe('Kitchen Equipment Canada');

      const itemList = findByType(blocks, 'ItemList');
      expect(itemList, 'ItemList schema').toBeTruthy();
    });

    test('ItemList contains every active company, positioned 1..N with the featured first', async ({ page }) => {
      await page.goto('/');
      const blocks = await getJsonLd(page);
      const itemList = findByType(blocks, 'ItemList')!;
      const elements = itemList.itemListElement as Array<Record<string, any>>;

      // numberOfItems is internally consistent with the element list, and covers
      // at least the known seed roster (prod may add more companies over time).
      expect(itemList.numberOfItems).toBe(elements.length);
      expect(elements.length).toBeGreaterThanOrEqual(COMPANIES.length);

      // Positions are 1-indexed and sequential.
      elements.forEach((el, i) => {
        expect(el.position).toBe(i + 1);
        expect(el['@type']).toBe('ListItem');
        expect(el.item['@id']).toMatch(/^https:\/\/kitchenequipment\.ca\/companies\//);
      });

      // The featured supplier is ranked #1, and every known company is present.
      expect(elements[0].item.name).toBe(FEATURED.name);
      const names = elements.map((el) => el.item.name);
      for (const c of COMPANIES) expect(names, `${c.name} in ItemList`).toContain(c.name);
    });

    test('every JSON-LD block is well-formed and has @context + @type', async ({ page }) => {
      await page.goto('/');
      const blocks = await getJsonLd(page);
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      for (const b of blocks) {
        expect(b['@context']).toBe('https://schema.org');
        expect(b['@type']).toBeTruthy();
      }
      expect(allByType(blocks, 'ItemList').length).toBe(1);
    });
  });
});
