import { test, expect } from '@playwright/test';

/**
 * Supplier-submission email verification (GET /api/verify-submission?token=…).
 * The valid-token path needs a seeded `unverified` row, so it is gated behind
 * E2E_VERIFY_TOKEN (set after seeding via the Supabase MCP — see e2e/README.md).
 */
test.describe('Verify submission — result page', () => {
  test('status=ok shows the success state', async ({ page }) => {
    await page.goto('/verify-submission?status=ok');
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to directory' })).toHaveAttribute('href', '/');
  });

  test('missing/invalid status shows the invalid state with an "Apply again" CTA', async ({ page }) => {
    await page.goto('/verify-submission?status=invalid');
    await expect(page.getByRole('heading', { name: 'Verification link invalid' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Apply again' })).toHaveAttribute('href', '/list-your-company');
  });
});

test.describe('Verify submission — token endpoint', () => {
  test('no token redirects to the invalid state', async ({ page }) => {
    await page.goto('/api/verify-submission');
    await expect(page).toHaveURL(/\/verify-submission\?status=invalid/);
    await expect(page.getByRole('heading', { name: 'Verification link invalid' })).toBeVisible();
  });

  test('a garbage token redirects to the invalid state', async ({ page }) => {
    await page.goto('/api/verify-submission?token=not-a-real-token-12345');
    await expect(page).toHaveURL(/\/verify-submission\?status=invalid/);
    await expect(page.getByRole('heading', { name: 'Verification link invalid' })).toBeVisible();
  });

  test('a valid unverified token verifies and redirects to status=ok', async ({ page }) => {
    const token = process.env.E2E_VERIFY_TOKEN;
    test.skip(!token, 'set E2E_VERIFY_TOKEN (seed an unverified submission via the Supabase MCP) to run this');

    await page.goto(`/api/verify-submission?token=${token}`);
    await expect(page).toHaveURL(/\/verify-submission\?status=ok/);
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  });
});
