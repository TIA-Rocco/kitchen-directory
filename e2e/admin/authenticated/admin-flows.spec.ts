import { test, expect, type Page } from '@playwright/test';
import { COMPANIES, FEATURED, E2E_MARKER, e2eName, apiHeaders } from '../../fixtures';

/**
 * Authenticated admin flows. Runs in the `admin` project with the stored
 * session (e2e/auth.setup.ts). If no session was minted (no creds), every test
 * self-skips after detecting the login redirect.
 *
 * Mutations are deliberately non-destructive to real content:
 *  - ranking preview is computed client-side and never saved;
 *  - the authenticated-API smoke targets a non-existent id (updates 0 rows);
 *  - the end-to-end loop only rejects a review THIS test created.
 */
test.describe('Admin (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    if (page.url().includes('/admin/login')) {
      test.skip(true, 'No admin session — set SUPABASE_SERVICE_ROLE_KEY or E2E_ADMIN_PASSWORD (see e2e/README.md).');
    }
  });

  test('dashboard shows the queues and recent activity', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Pending submissions')).toBeVisible();
    await expect(page.getByText('Pending reviews')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  });

  test('reviews queue renders the moderation table or empty state', async ({ page }) => {
    await page.goto('/admin/reviews');
    await expect(page.getByRole('heading', { name: /Pending moderation \(\d+\)/ })).toBeVisible();
  });

  test('submissions queue exposes the status filter tabs', async ({ page }) => {
    await page.goto('/admin/submissions');
    for (const tab of ['Open', 'Pending', 'Needs info', 'Approved', 'Rejected', 'All']) {
      await expect(page.getByRole('link', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('companies list shows every company with an edit link + new-company CTA', async ({ page }) => {
    await page.goto('/admin/companies');
    await expect(page.getByRole('link', { name: '+ New company' })).toHaveAttribute('href', '/admin/companies/new');
    for (const c of COMPANIES) {
      await expect(page.getByText(c.name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator(`a[href="/admin/companies/${FEATURED.slug}"]`)).toBeVisible();
  });

  test('new-company form renders the shared CompanyForm', async ({ page }) => {
    await page.goto('/admin/companies/new');
    await expect(page.getByRole('heading', { name: 'New company' })).toBeVisible();
    await expect(page.locator('[data-field="name"]')).toBeVisible();
    await expect(page.locator('[data-field="description"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create company' })).toBeVisible();
  });

  test('company edit page prefills profile + recomputes ranking preview live (no save)', async ({ page }) => {
    await page.goto(`/admin/companies/${FEATURED.slug}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.locator('[data-field="name"]')).toHaveValue(FEATURED.name);

    // Ranking form: six criteria inputs + a live preview that updates on input.
    const ranking = page.locator('#ranking-form');
    await expect(ranking.locator('input[type="number"]')).toHaveCount(6);
    const preview = page.locator('#preview-score');
    await ranking.locator('#r_service_range').fill('10');
    await ranking.locator('#r_customer_reviews').fill('10');
    await expect(preview).not.toHaveText('—');
    // Never click "Save ranking" — we must not mutate production scores.
  });

  test('authenticated admin API is accepted (not 401/403)', async ({ request }) => {
    // Targets a non-existent review id → updates 0 rows, harmless, but proves the
    // session passes the middleware gate (would be 401 when unauthenticated).
    const res = await request.post('/api/admin/reviews/00000000-0000-0000-0000-000000000000/approve', {
      headers: apiHeaders(),
    });
    expect([200, 500]).toContain(res.status()); // 200 (no-op) expected; never 401/403
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test('end-to-end: a freshly submitted review appears in the queue and can be rejected', async ({ page, request }) => {
    // 1. Create a pending review via the public flow (real insert, marked).
    const reviewer = e2eName('admin-loop');
    const companyId = await firstCompanyId(page);
    const insert = await request.post('/api/review', {
      headers: apiHeaders(),
      form: {
        company_id: companyId,
        reviewer_name: reviewer,
        rating: '4',
        service_category: 'Price Match',
        review_text: `Admin-loop E2E review, please ignore. ${E2E_MARKER}`,
      },
    });
    expect(insert.status()).toBe(200);

    // 2. It shows in the moderation queue.
    await page.goto('/admin/reviews');
    const row = page.locator('[data-review-row]', { hasText: reviewer });
    await expect(row).toHaveCount(1);

    // 3. Reject it (confirm() dialog) → row removed, "Rejected." toast.
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Reject' }).click();
    await expect(row).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Rejected');
    // Row is left status='rejected' (never published); cleanup SQL removes it.
  });
});

/** Read a real company UUID from the public review form's option values. */
async function firstCompanyId(page: Page): Promise<string> {
  await page.goto('/submit-review');
  const value = await page.locator('#company option[value]:not([value=""])').first().getAttribute('value');
  expect(value, 'a company option value (UUID)').toBeTruthy();
  return value!;
}
