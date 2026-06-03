import { test, expect } from '@playwright/test';
import { E2E_MARKER, e2eName, expectSingleH1, apiHeaders } from '../fixtures';

const FETCH_HEADERS = apiHeaders();

test.describe('Contact form — page behavior', () => {
  test('renders with the reason selector and honeypot', async ({ page }) => {
    await page.goto('/contact');
    expect(await expectSingleH1(page)).toBe('Contact Us');
    await expect(page.locator('#reason')).toBeVisible();
    await expect(page.locator('#fax')).toBeHidden(); // honeypot
  });

  test('"List My Company" reason reveals the dedicated-form notice', async ({ page }) => {
    await page.goto('/contact');
    const notice = page.locator('#submit-company-notice');
    await expect(notice).toBeHidden();

    await page.locator('#reason').selectOption('submit_company');
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link', { name: /Apply on our dedicated form/ })).toHaveAttribute('href', '/list-your-company');

    await page.locator('#reason').selectOption('general');
    await expect(notice).toBeHidden();
  });

  test('submitting with "List My Company" is intercepted client-side (no network, no insert)', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('#reason').selectOption('submit_company');
    await page.locator('#contact_name').fill('E2E');
    await page.locator('#contact_email').fill('e2e@business-example.com');
    await page.locator('#message').fill('test');

    let posted = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/contact') && r.method() === 'POST') posted = true;
    });
    await page.getByRole('button', { name: 'Send Message' }).click();

    await expect(page).toHaveURL(/\/contact$/);
    const errorBox = page.locator('#contact-error');
    await expect(errorBox).toBeVisible();
    await expect(errorBox.getByRole('link', { name: 'dedicated application form' })).toHaveAttribute('href', '/list-your-company');
    expect(posted, 'should NOT POST to /api/contact for submit_company').toBe(false);
  });

  test('native required validation blocks an empty submit', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Send Message' }).click();
    await expect(page).toHaveURL(/\/contact$/);
    const nameMissing = await page.locator('#contact_name').evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(nameMissing).toBe(true);
  });

  test('invalid email is rejected by native validation', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('#contact_name').fill('Tester');
    await page.locator('#contact_email').fill('not-an-email');
    await page.locator('#message').fill('Hello');
    await page.getByRole('button', { name: 'Send Message' }).click();

    await expect(page).toHaveURL(/\/contact$/);
    const emailValid = await page.locator('#contact_email').evaluate((el) => (el as HTMLInputElement).validity.valid);
    expect(emailValid).toBe(false);
  });
});

test.describe('Contact form — API contract', () => {
  test('honeypot submission is silently accepted (no insert)', async ({ request }) => {
    const res = await request.post('/api/contact', {
      headers: FETCH_HEADERS,
      form: { fax: '+1-555', name: 'bot', email: 'b@b.com', type: 'general', message: 'spam' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('submit_company type is rejected server-side → 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      headers: FETCH_HEADERS,
      form: { name: 'A', email: 'a@b.com', type: 'submit_company', message: 'hi' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Please choose a valid reason for contact.');
  });

  test('missing name → 400; missing message → 400', async ({ request }) => {
    const noName = await request.post('/api/contact', { headers: FETCH_HEADERS, form: { email: 'a@b.com', type: 'general', message: 'hi' } });
    expect(noName.status()).toBe(400);
    expect((await noName.json()).error).toBe('Name is required.');

    const noMsg = await request.post('/api/contact', { headers: FETCH_HEADERS, form: { name: 'A', email: 'a@b.com', type: 'general' } });
    expect(noMsg.status()).toBe(400);
    expect((await noMsg.json()).error).toBe('Message is required.');
  });
});

test.describe('Contact form — happy path (REAL insert, tagged for cleanup)', () => {
  test('valid general inquiry redirects to /thank-you', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('#reason').selectOption('general');
    await page.locator('#contact_name').fill(e2eName('contact'));
    await page.locator('#contact_email').fill('e2e-tester@business-example.com');
    await page.locator('#message').fill(`Automated E2E smoke test, please ignore. ${E2E_MARKER}`);

    await Promise.all([
      page.waitForURL(/\/thank-you/),
      page.getByRole('button', { name: 'Send Message' }).click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  });
});
