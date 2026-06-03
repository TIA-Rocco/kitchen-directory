import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { COMPANIES, SERVICES, BLOG_POSTS } from '../fixtures';

/**
 * Automated WCAG 2.1 A/AA scan via axe-core, plus manual structural checks.
 *
 * Policy: HARD-FAIL on `critical` violations (real blockers — e.g. unlabeled
 * controls). `serious` findings (mostly colour-contrast) are reported as test
 * annotations + console warnings so they surface without making the suite
 * permanently red over design-token contrast choices. Tighten to also fail on
 * `serious` once the known contrast items are addressed.
 */
/**
 * Baselined known criticals: real, pre-existing app bugs the suite has surfaced.
 * Listed here so the gate stays green for KNOWN issues but still fails on any NEW
 * critical regression. Add an entry only with a tracking note; remove it once the
 * underlying app bug is fixed.
 *
 * (Empty: finding #2 — unlabeled star-rating radios on /submit-review — was fixed
 * by adding per-radio aria-labels + a radiogroup, so the gate now enforces zero
 * criticals on every page.)
 */
const KNOWN_CRITICALS: Record<string, string[]> = {};

const PAGES_TO_SCAN = [
  { name: 'homepage', path: '/' },
  { name: 'company profile', path: `/companies/${COMPANIES[0].slug}` },
  { name: 'service category', path: `/services/${SERVICES[4].slug}` },
  { name: 'blog index', path: '/blog' },
  { name: 'blog post', path: `/blog/${BLOG_POSTS[0]}` },
  { name: 'submit review', path: '/submit-review' },
  { name: 'contact', path: '/contact' },
  { name: 'list your company', path: '/list-your-company' },
];

test.describe('Accessibility (axe-core WCAG 2.1 A/AA)', () => {
  for (const p of PAGES_TO_SCAN) {
    test(`${p.name} has no critical violations`, async ({ page }, testInfo) => {
      await page.goto(p.path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const fmt = (v: (typeof results.violations)[number]) =>
        `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.helpUrl}`;

      const allowed = KNOWN_CRITICALS[p.name] ?? [];
      const critical = results.violations.filter((v) => v.impact === 'critical');
      const serious = results.violations.filter((v) => v.impact === 'serious');
      const newCriticals = critical.filter((v) => !allowed.includes(v.id));

      // Report serious + known-critical findings without failing the run.
      const reportable = [...serious, ...critical.filter((v) => allowed.includes(v.id))];
      if (reportable.length) {
        const note = `a11y findings on ${p.name} (non-blocking):\n  ` + reportable.map(fmt).join('\n  ');
        testInfo.annotations.push({ type: 'a11y', description: note });
        console.warn(`\n⚠️  ${note}\n`);
      }

      const summary = newCriticals.map((v) => `  • ${fmt(v)}`).join('\n');
      expect(newCriticals, `NEW critical accessibility violations on ${p.name}:\n${summary}`).toEqual([]);
    });
  }
});

test.describe('Accessibility — manual structural checks', () => {
  test('all images have alt attributes on the homepage and a company page', async ({ page }) => {
    for (const path of ['/', `/companies/${COMPANIES[0].slug}`]) {
      await page.goto(path);
      const missing = await page.locator('img:not([alt])').count();
      expect(missing, `images missing alt on ${path}`).toBe(0);
    }
  });

  test('every form control on the contact form has an accessible name', async ({ page }) => {
    await page.goto('/contact');
    const controls = page.locator('form#contact-form input:not([type=hidden]), form#contact-form select, form#contact-form textarea');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const el = controls.nth(i);
      const id = await el.getAttribute('id');
      const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
      const aria = (await el.getAttribute('aria-label')) || (await el.getAttribute('aria-labelledby'));
      expect(hasLabel || !!aria, `control #${i} (id=${id}) needs a label`).toBeTruthy();
    }
  });

  test('keyboard focus reaches the primary nav links', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(['a', 'button', 'input']).toContain(active);
  });
});
