import { test, expect } from '@playwright/test';
import { apiHeaders } from '../fixtures';

/**
 * Unauthenticated admin gate. Runs in the default (no-session) project, so
 * every request here is anonymous.
 */
const RANDOM_UUID = '00000000-0000-0000-0000-000000000000';

test.describe('Admin gate — unauthenticated pages redirect to login', () => {
  for (const path of ['/admin', '/admin/submissions', '/admin/reviews', '/admin/companies', '/admin/companies/new']) {
    test(`${path} redirects to /admin/login with a next param`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
      expect(decodeURIComponent(page.url())).toContain(`next=${path}`);
    });
  }
});

test.describe('Admin login page', () => {
  test('renders the magic-link request form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByText('Admin sign-in')).toBeVisible();
    await expect(page.locator('input#email[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
    await expect(page.getByText('Only emails on the admin allow-list can sign in.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to site/ })).toHaveAttribute('href', '/');
  });

  test('?sent=1 shows the check-your-inbox confirmation (no form)', async ({ page }) => {
    await page.goto('/admin/login?sent=1');
    await expect(page.getByText('Check your inbox')).toBeVisible();
    await expect(page.locator('input#email')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Use a different email' })).toHaveAttribute('href', '/admin/login');
  });

  test('?error= surfaces a failure message', async ({ page }) => {
    await page.goto('/admin/login?error=otp_expired');
    await expect(page.getByText(/Sign-in failed: otp_expired/)).toBeVisible();
  });
});

test.describe('Admin login API (anti-enumeration)', () => {
  test('a non-allowlisted email still redirects to ?sent=1 (no account disclosure)', async ({ request }) => {
    const res = await request.post('/api/admin/login', {
      headers: apiHeaders(),
      form: { email: 'definitely-not-an-admin-e2e@example.com', next: '/admin' },
    });
    // Always lands on the neutral confirmation regardless of outcome.
    expect(res.url()).toContain('sent=1');
  });
});

test.describe('Admin API — unauthenticated requests are 401', () => {
  test('POST /api/admin/reviews/:id/approve → 401 unauthorized', async ({ request }) => {
    const res = await request.post(`/api/admin/reviews/${RANDOM_UUID}/approve`, { headers: apiHeaders() });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe('unauthorized');
  });

  test('POST /api/admin/companies/create → 401 unauthorized', async ({ request }) => {
    const res = await request.post('/api/admin/companies/create', {
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      data: { name: 'X', description: 'Y' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe('unauthorized');
  });

  test('POST /api/admin/submissions/:id/reject → 401 unauthorized', async ({ request }) => {
    const res = await request.post(`/api/admin/submissions/${RANDOM_UUID}/reject`, { headers: apiHeaders() });
    expect(res.status()).toBe(401);
  });
});
