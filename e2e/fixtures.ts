/**
 * Shared test data + helpers for the Kitchen Directory E2E suite.
 *
 * Real production data (slugs, names) lives here so specs are parametrized and
 * a single source needs updating when the directory changes.
 */
import { type Page, expect } from '@playwright/test';

/** Companies seeded in production, ranked highest → lowest. */
export const COMPANIES = [
  { slug: 'shop-at-stop', name: 'Shop at Stop Restaurant Supply', score: 9.4, featured: true, city: 'Toronto', partners: 12, faq: 6 },
  { slug: 'russell-hendrix', name: 'Russell Hendrix Foodservice Equipment', score: 7.7, featured: false, city: 'Toronto', partners: 0, faq: 2 },
  { slug: 'nella-cutlery', name: 'Nella Cutlery & Food Equipment', score: 7.5, featured: false, city: 'Toronto', partners: 0, faq: 2 },
  { slug: 'canada-food-equipment', name: 'Canada Food Equipment Ltd', score: 6.7, featured: false, city: 'Toronto', partners: 0, faq: 1 },
  { slug: 'chefco', name: 'Chefco Kitchen & Restaurant Supplies', score: 6.7, featured: false, city: 'Toronto', partners: 0, faq: 1 },
  { slug: 'wd-colledge', name: 'W.D. Colledge Co. Ltd', score: 6.7, featured: false, city: 'Mississauga', partners: 0, faq: 1 },
  { slug: 'igloo-food-equipment', name: 'Igloo Food Equipment', score: 5.9, featured: false, city: 'Toronto', partners: 0, faq: 1 },
] as const;

export const FEATURED = COMPANIES.find((c) => c.featured)!; // shop-at-stop

/** Service categories (slug + display name). */
export const SERVICES = [
  { slug: 'account-management', name: 'Account Management' },
  { slug: 'commercial-equipment-procurement', name: 'Commercial Equipment Procurement' },
  { slug: 'design-and-technical-drawings', name: 'Design & Technical Drawings' },
  { slug: 'equipment-consulting', name: 'Equipment Consulting' },
  { slug: 'equipment-financing', name: 'Equipment Financing' },
  { slug: 'equipment-leasing', name: 'Equipment Leasing' },
  { slug: 'installation-services', name: 'Installation Services' },
  { slug: 'price-match', name: 'Price Match' },
  { slug: 'restaurant-consulting', name: 'Restaurant Consulting' },
] as const;

/** Published blog posts. */
export const BLOG_POSTS = [
  'new-vs-used-commercial-kitchen-equipment',
  'opening-a-restaurant-toronto-equipment-checklist',
  'commercial-kitchen-design-and-layout-guide',
  'commercial-kitchen-smallwares-cutlery-essentials',
  'restaurant-equipment-financing-vs-leasing-canada',
  'choosing-commercial-cooking-equipment-ranges-ovens-fryers',
  'commercial-dishwasher-buying-guide-canada',
  'best-commercial-refrigeration-suppliers-ontario',
  'best-commercial-kitchen-equipment-suppliers-toronto',
] as const;

/** Static + functional routes. */
export const STATIC_PAGES = ['/privacy', '/terms', '/thank-you', '/contact', '/submit-review', '/list-your-company', '/blog'] as const;

/**
 * Marker stamped into every row our tests insert into the production DB, so
 * they can be found and deleted afterwards. Keep in sync with e2e/README.md
 * cleanup SQL.
 */
export const E2E_MARKER = '[[KE-E2E]]';

/** Base URL under test (mirrors playwright.config). */
export const BASE_URL = process.env.BASE_URL || 'https://kitchen-directory.vercel.app';

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Headers that make an APIRequestContext POST look like a same-origin browser
 * fetch. Production's edge rejects POSTs that lack an Origin / Sec-Fetch-Site
 * with a 403 (anti-CSRF/bot heuristic), exactly as a naked curl would be blocked.
 * The real forms send these implicitly; our API-contract tests must too.
 */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Origin: BASE_URL,
    Referer: `${BASE_URL}/`,
    'User-Agent': CHROME_UA,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'X-Requested-With': 'fetch',
    ...extra,
  };
}

/** A per-run-unique reviewer/contact name that is trivially greppable. */
export function e2eName(label: string): string {
  // No Date.now() needed for uniqueness — a random-ish suffix from performance + index.
  const rand = Math.random().toString(36).slice(2, 8);
  return `KE-E2E ${label} ${rand}`;
}

/* ------------------------------------------------------------------ */
/* JSON-LD helpers — structured data is this project's primary deliverable. */
/* ------------------------------------------------------------------ */

export type Json = Record<string, unknown>;

/** Parse every <script type="application/ld+json"> on the page. Asserts each is valid JSON. */
export async function getJsonLd(page: Page): Promise<Json[]> {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  return raw.map((text, i) => {
    try {
      return JSON.parse(text) as Json;
    } catch (err) {
      throw new Error(`JSON-LD block #${i} is not valid JSON: ${(err as Error).message}\n---\n${text}`);
    }
  });
}

/** Find the first JSON-LD block whose @type matches (handles @type being an array). */
export function findByType(blocks: Json[], type: string): Json | undefined {
  return blocks.find((b) => {
    const t = b['@type'];
    return Array.isArray(t) ? t.includes(type) : t === type;
  });
}

export function allByType(blocks: Json[], type: string): Json[] {
  return blocks.filter((b) => {
    const t = b['@type'];
    return Array.isArray(t) ? t.includes(type) : t === type;
  });
}

/** Assert a page has no console errors / uncaught exceptions during the test. */
export function trackPageErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return { errors };
}

/**
 * Benign console-error substrings to ignore: third-party widgets, analytics
 * beacons and favicon noise are not app bugs.
 */
const IGNORED_ERROR_PATTERNS = [
  'favicon',
  'analytics',
  '/_vercel/insights',
  'net::ERR_',
  'Failed to load resource', // covers blocked third-party assets (logos CDN, fonts)
  'challenges.cloudflare.com',
  'assets.ui.sh',
  // NOTE: the Inter font (rsms.me) CORS error is intentionally NOT ignored anymore
  // — finding #1 was fixed by self-hosting the font, so any reappearance is a real
  // regression the console-error assertions should catch.
];

export function filterAppErrors(errors: string[]): string[] {
  return errors.filter((e) => !IGNORED_ERROR_PATTERNS.some((p) => e.toLowerCase().includes(p.toLowerCase())));
}

/** Assert the document has exactly one <h1> with non-empty text. */
export async function expectSingleH1(page: Page): Promise<string> {
  const h1s = page.locator('h1');
  await expect(h1s).toHaveCount(1);
  const text = (await h1s.first().textContent())?.trim() ?? '';
  expect(text.length).toBeGreaterThan(0);
  return text;
}

/** Assert no element overflows the viewport horizontally (no sideways scroll). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    // 1px tolerance for sub-pixel rounding.
    return de.scrollWidth - de.clientWidth;
  });
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}
