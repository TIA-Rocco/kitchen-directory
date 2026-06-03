import { test, expect } from '@playwright/test';
import { trackPageErrors, filterAppErrors, expectSingleH1 } from '../fixtures';

test.describe('Static / functional pages', () => {
  test('privacy policy renders', async ({ page }) => {
    const res = await page.goto('/privacy');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Kitchen Equipment Canada/);
    await expectSingleH1(page);
    await expect(page.locator('footer')).toBeVisible();
  });

  test('terms of service renders', async ({ page }) => {
    const res = await page.goto('/terms');
    expect(res?.status()).toBe(200);
    await expectSingleH1(page);
    await expect(page.locator('footer')).toBeVisible();
  });

  test('thank-you confirmation renders', async ({ page }) => {
    await page.goto('/thank-you');
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
    await expect(page.getByText('Your submission has been received.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to directory' })).toHaveAttribute('href', '/');
  });

  test('thank-you?type=submission variant also renders', async ({ page }) => {
    await page.goto('/thank-you?type=submission');
    await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  });

  test('unknown route returns 404 status AND the custom 404 page', async ({ page }) => {
    const res = await page.goto('/totally/unknown/path-xyz');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to directory' })).toHaveAttribute('href', '/');
  });

  test('footer legal links resolve from a content page', async ({ page }) => {
    const tracker = trackPageErrors(page);
    await page.goto('/contact');
    const footer = page.locator('footer');

    await footer.getByRole('link', { name: 'Privacy Policy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.goBack();
    await footer.getByRole('link', { name: 'Terms of Service' }).click();
    await expect(page).toHaveURL(/\/terms$/);

    expect(filterAppErrors(tracker.errors), tracker.errors.join('\n')).toEqual([]);
  });
});
