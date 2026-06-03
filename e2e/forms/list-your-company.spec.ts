import { test, expect } from '@playwright/test';
import { expectSingleH1, apiHeaders } from '../fixtures';

/**
 * The supplier-application wizard is progressively enhanced: with JS it becomes
 * a 4-step flow; the API is honeypot + Cloudflare-Turnstile gated. In production
 * a genuine happy-path insert is intentionally NOT automatable (we can't solve
 * the bot challenge), so coverage focuses on wizard UX, per-step validation,
 * the honeypot redirect, and verifying the bot gate is actually enforced.
 */

test.describe('List your company — page + wizard', () => {
  test('renders the application intro and step 1', async ({ page }) => {
    await page.goto('/list-your-company');
    expect((await expectSingleH1(page)).toLowerCase()).toContain('apply to be listed');
    await expect(page.getByText('What happens next')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tell us about your company' })).toBeVisible();
  });

  test('JS activates the wizard: only step 1 shown, Back disabled', async ({ page }) => {
    await page.goto('/list-your-company');
    await expect(page.locator('[data-wizard-nav]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tell us about your company' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Where you operate' })).toBeHidden();
    await expect(page.locator('[data-wizard-back]')).toBeDisabled();
  });

  test('cannot advance past step 1 with empty required fields', async ({ page }) => {
    await page.goto('/list-your-company');
    await page.locator('[data-wizard-next]').click();
    // Still on step 1 (native validation blocked the advance).
    await expect(page.getByRole('heading', { name: 'Where you operate' })).toBeHidden();
    const nameMissing = await page.locator('#name').evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(nameMissing).toBe(true);
  });

  test('step 2 requires at least one service', async ({ page }) => {
    await page.goto('/list-your-company');
    await fillStep1(page);
    await page.locator('[data-wizard-next]').click();
    await expect(page.getByRole('heading', { name: 'Where you operate' })).toBeVisible();

    // Fill address but select no service, then try to advance.
    await page.locator('#street').fill('1 Test Street');
    await page.locator('#city').fill('Toronto');
    await page.locator('#province').selectOption('ON');
    await page.locator('#postal').fill('M5V 2T6');
    await page.locator('[data-wizard-next]').click();

    await expect(page.getByRole('heading', { name: 'Share your story' })).toBeHidden();
    const msg = await page.locator('input[name="services"]').first().evaluate((el) => (el as HTMLInputElement).validationMessage);
    expect(msg).toContain('at least one service');
  });

  test('step 3 enforces a 100-character minimum description (with live counter)', async ({ page }) => {
    await page.goto('/list-your-company');
    await fillStep1(page);
    await page.locator('[data-wizard-next]').click();
    await fillStep2(page);
    await page.locator('[data-wizard-next]').click();
    await expect(page.getByRole('heading', { name: 'Share your story' })).toBeVisible();

    await page.locator('#description').fill('Too short.');
    await expect(page.locator('[data-char-count]')).toHaveText('10');
    await page.locator('#faq_q_1').fill('Do you deliver?');
    await page.locator('#faq_a_1').fill('Yes, across the GTA.');
    await page.locator('[data-wizard-next]').click();

    await expect(page.getByRole('heading', { name: 'About you' })).toBeHidden();
    // Either the native minlength message or the wizard's custom message — both
    // reference the 100-character floor.
    const descMsg = await page.locator('#description').evaluate((el) => (el as HTMLTextAreaElement).validationMessage);
    expect(descMsg).toContain('100 characters');
  });

  test('full wizard walk reaches step 4 with a working bot challenge / dev notice', async ({ page }) => {
    await page.goto('/list-your-company');
    await fillStep1(page);
    await page.locator('[data-wizard-next]').click();
    await fillStep2(page);
    await page.locator('[data-wizard-next]').click();
    await fillStep3(page);
    await page.locator('[data-wizard-next]').click();

    await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
    await page.locator('#submitted_by_name').fill('QA Tester');
    await page.locator('#submitted_by_email').fill('qa@business-example.com');

    // Either the real Turnstile widget OR the dev "not configured" notice must be present.
    const widget = page.locator('.cf-turnstile');
    const devNotice = page.getByText('Turnstile not configured');
    const hasGate = (await widget.count()) > 0 || (await devNotice.count()) > 0;
    expect(hasGate, 'step 4 must show a bot-challenge widget or the dev notice').toBe(true);
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeVisible();

    // Back navigation returns to step 3 with data intact.
    await page.locator('[data-wizard-back]').click();
    await expect(page.getByRole('heading', { name: 'Share your story' })).toBeVisible();
    await expect(page.locator('#faq_q_1')).toHaveValue('Do you deliver?');
  });
});

test.describe('List your company — API contract', () => {
  test('honeypot submission redirects to thank-you (no insert)', async ({ request }) => {
    const res = await request.post('/api/list-company', {
      headers: apiHeaders(),
      multipart: { business_fax: 'spam', name: 'Bot Co', business_email: 'bot@bot.com' },
    });
    expect(res.url()).toContain('/thank-you');
  });

  test('the bot gate is enforced in production — a tokenless submit is rejected (403)', async ({ request }) => {
    const res = await request.post('/api/list-company', {
      headers: apiHeaders(),
      multipart: {
        name: 'E2E Probe Co',
        website_url: 'https://example.com',
        phone: '416-555-0100',
        business_email: 'probe@business-example.com',
        street: '1 Test St',
        city: 'Toronto',
        province: 'ON',
        postal: 'M5V 2T6',
        description: 'x'.repeat(120),
        submitted_by_name: 'Probe',
        submitted_by_email: 'probe@business-example.com',
        services: 'price-match',
        faq_q_1: 'Q',
        faq_a_1: 'A',
      },
    });
    // Turnstile verification fails (missing token / missing secret) before any DB write.
    expect(res.status()).toBe(403);
  });
});

// ---- step helpers (valid data) ----
async function fillStep1(page: import('@playwright/test').Page) {
  await page.locator('#name').fill('E2E Test Kitchen Supply');
  await page.locator('#website_url').fill('https://e2e-example.com');
  await page.locator('#phone').fill('416-555-0123');
  await page.locator('#business_email').fill('qa@business-example.com');
}
async function fillStep2(page: import('@playwright/test').Page) {
  await page.locator('#street').fill('1 Test Street');
  await page.locator('#city').fill('Toronto');
  await page.locator('#province').selectOption('ON');
  await page.locator('#postal').fill('M5V 2T6');
  await page.locator('input[name="services"]').first().check();
}
async function fillStep3(page: import('@playwright/test').Page) {
  await page.locator('#description').fill(
    'We are a Canadian commercial kitchen equipment supplier serving restaurants across the GTA with procurement, installation and service. '.repeat(2),
  );
  await page.locator('#faq_q_1').fill('Do you deliver?');
  await page.locator('#faq_a_1').fill('Yes, across the GTA.');
}
