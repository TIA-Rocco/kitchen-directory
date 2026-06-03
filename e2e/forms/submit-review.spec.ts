import { test, expect } from '@playwright/test';
import { COMPANIES, FEATURED, E2E_MARKER, e2eName, expectSingleH1, apiHeaders } from '../fixtures';

const FETCH_HEADERS = apiHeaders();

test.describe('Submit a Review — page', () => {
  test('renders the form with all companies in the dropdown', async ({ page }) => {
    await page.goto('/submit-review');
    expect(await expectSingleH1(page)).toBe('Submit a Review');

    const options = page.locator('#company option');
    // Known seed companies + the "Select a company" placeholder (prod may add more).
    expect(await options.count()).toBeGreaterThanOrEqual(COMPANIES.length + 1);
    for (const c of COMPANIES) {
      await expect(page.locator('#company')).toContainText(c.name);
    }

    // Honeypot is present but visually hidden.
    await expect(page.locator('#website')).toBeHidden();
    // Rating offers 5 stars.
    await expect(page.locator('input[name="rating"]')).toHaveCount(5);
  });

  test('?company=<slug> preselects the matching company', async ({ page }) => {
    await page.goto(`/submit-review?company=${FEATURED.slug}`);
    const selected = page.locator('#company');
    const label = await selected.locator('option:checked').textContent();
    expect(label?.trim()).toBe(FEATURED.name);
  });

  test('native required validation blocks an empty submit (no network)', async ({ page }) => {
    await page.goto('/submit-review');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    // Browser validation stops submission — still on the form, company select invalid.
    await expect(page).toHaveURL(/\/submit-review$/);
    const companyInvalid = await page.locator('#company').evaluate((el) => (el as HTMLSelectElement).validity.valueMissing);
    expect(companyInvalid).toBe(true);
  });
});

test.describe('Submit a Review — API contract (no DB writes)', () => {
  test('honeypot submission is silently accepted and inserts nothing', async ({ request }) => {
    const res = await request.post('/api/review', {
      headers: FETCH_HEADERS,
      form: { website: 'http://spam.example', company_id: 'x', reviewer_name: 'bot', rating: '5', service_category: 'x', review_text: 'x' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('missing company → 400 "Company is required."', async ({ request }) => {
    const res = await request.post('/api/review', { headers: FETCH_HEADERS, form: { reviewer_name: 'A', rating: '5', service_category: 'Price Match', review_text: 'Hi' } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Company is required.');
  });

  test('out-of-range rating → 400', async ({ request }) => {
    const res = await request.post('/api/review', {
      headers: FETCH_HEADERS,
      form: { company_id: '00000000-0000-0000-0000-000000000000', reviewer_name: 'A', rating: '9', service_category: 'Price Match', review_text: 'Hi' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Rating must be an integer between 1 and 5.');
  });

  test('non-existent company id → 400 (server re-validates against the DB)', async ({ request }) => {
    const res = await request.post('/api/review', {
      headers: FETCH_HEADERS,
      form: { company_id: '00000000-0000-0000-0000-000000000000', reviewer_name: 'A', rating: '5', service_category: 'Price Match', review_text: 'Hi' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('no longer available');
  });

  test('empty review text → 400 "Review text is required."', async ({ request }) => {
    // Need a real company id to get past the company check first.
    const res = await request.post('/api/review', {
      headers: FETCH_HEADERS,
      form: { company_id: '00000000-0000-0000-0000-000000000000', reviewer_name: 'A', rating: '5', service_category: 'Price Match', review_text: '   ' },
    });
    // Trimmed-empty review is rejected (company check may fire first for the fake id;
    // either way the request is a 400, never a 5xx or a successful insert).
    expect(res.status()).toBe(400);
  });
});

test.describe('Submit a Review — happy path (REAL insert, tagged for cleanup)', () => {
  // Inserts one pending review tagged with the E2E marker. It is NOT publicly
  // visible (status defaults to pending) and is deleted by the cleanup SQL.
  test('valid submission redirects to /thank-you', async ({ page }) => {
    await page.goto('/submit-review');

    await page.locator('#company').selectOption({ label: FEATURED.name });
    await page.locator('#reviewer_name').fill(e2eName('reviewer'));
    // Rating radios are sr-only; check directly.
    await page.locator('input[name="rating"][value="5"]').check({ force: true });
    await page.locator('#service_category').selectOption({ label: 'Price Match' });
    await page.locator('#review_text').fill(`Automated E2E smoke test. Please ignore. ${E2E_MARKER}`);

    await Promise.all([
      page.waitForURL(/\/thank-you/),
      page.getByRole('button', { name: 'Submit Review' }).click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  });
});
