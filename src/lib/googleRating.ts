// Helpers for the attributed third-party Google rating badge (display-only).
//
// IMPORTANT: this data is shown as Google-attributed third-party content and is
// NEVER emitted as the page's own AggregateRating / Review JSON-LD. The site's
// own structured rating stays first-party (approved reviews) via
// src/lib/schema.ts -> buildAggregateRatingSchema. See the build spec:
//   ~/.gstack/projects/KitchenDirectory/google-reviews-build-spec-20260604.md
//
// Kept in a .ts module (not inline in .astro frontmatter) so the arithmetic is
// unit-tested and to avoid the @astrojs/compiler frontmatter tokenizer quirk
// noted in src/lib/reviews.ts.

export interface GoogleRatingFields {
  google_rating?: number | null;
  google_review_count?: number | null;
  google_rating_as_of?: string | null;
  google_place_id?: string | null;
  google_place_url?: string | null;
}

/**
 * True only when there's a real Google rating worth showing. The deliverable is
 * "rating + review count", so we require BOTH a positive rating and a positive
 * review count — otherwise manual admin/API entry of a rating with a blank count
 * would publish a misleading "4.4 · 0 reviews" badge. (The snapshot script never
 * emits that; it skips places with no rating/count.)
 */
export function hasGoogleRating(c: GoogleRatingFields | null | undefined): boolean {
  if (!c) return false;
  const r = c.google_rating;
  const n = c.google_review_count;
  return (
    typeof r === 'number' && Number.isFinite(r) && r > 0 &&
    typeof n === 'number' && Number.isFinite(n) && n > 0
  );
}

/** Clamp a rating to the 0–5 scale (defensive against bad data). */
export function clampGoogleRating(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  return Math.min(5, Math.max(0, rating));
}

/**
 * Percentage (0–100) of the 5-star track to fill for a fractional star bar.
 * 4.4 -> 88. Lets us render true partial stars instead of rounding to whole.
 */
export function googleStarFillPercent(rating: number): number {
  return Math.round(clampGoogleRating(rating) * 20);
}

/**
 * Accessible label for the star group, e.g. "Rated 4.4 out of 5 on Google".
 * Don't rely on the SVG stars alone (a11y).
 */
export function googleAriaLabel(rating: number): string {
  return `Rated ${clampGoogleRating(rating)} out of 5 on Google`;
}

/** "241 reviews" / "1 review" / "1,000 reviews" (en-CA grouping). */
export function formatGoogleReviewCount(count: number | null | undefined): string {
  const n = typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const noun = n === 1 ? 'review' : 'reviews';
  return `${n.toLocaleString('en-CA')} ${noun}`;
}

/**
 * Format the snapshot date as "Jun 2026" for the honesty/ToS "as of" line.
 * Parsed in UTC to avoid a timezone off-by-one on the date-only value.
 * Returns '' for missing/invalid input.
 */
export function formatGoogleAsOf(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Link target for the required "View on Google" attribution. Prefers the stored
 * place URL; falls back to a place_id Maps link; null when neither is present.
 */
export function googlePlaceHref(c: GoogleRatingFields | null | undefined): string | null {
  if (!c) return null;
  if (c.google_place_url && c.google_place_url.trim()) return c.google_place_url.trim();
  if (c.google_place_id && c.google_place_id.trim()) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(c.google_place_id.trim())}`;
  }
  return null;
}
