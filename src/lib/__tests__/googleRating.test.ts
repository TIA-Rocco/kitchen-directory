import { describe, it, expect } from 'vitest';
import {
  hasGoogleRating,
  clampGoogleRating,
  googleStarFillPercent,
  googleAriaLabel,
  formatGoogleReviewCount,
  formatGoogleAsOf,
  googlePlaceHref,
} from '../googleRating';

describe('hasGoogleRating', () => {
  it('is false for null/undefined/missing rating', () => {
    expect(hasGoogleRating(null)).toBe(false);
    expect(hasGoogleRating(undefined)).toBe(false);
    expect(hasGoogleRating({})).toBe(false);
    expect(hasGoogleRating({ google_rating: null, google_review_count: 5 })).toBe(false);
  });

  it('is false for a zero or non-finite rating (no real reviews)', () => {
    expect(hasGoogleRating({ google_rating: 0, google_review_count: 5 })).toBe(false);
    expect(hasGoogleRating({ google_rating: NaN, google_review_count: 5 })).toBe(false);
  });

  it('is false for a positive rating with no/zero review count (avoids "4.4 · 0 reviews")', () => {
    expect(hasGoogleRating({ google_rating: 4.4 })).toBe(false);
    expect(hasGoogleRating({ google_rating: 4.4, google_review_count: 0 })).toBe(false);
    expect(hasGoogleRating({ google_rating: 4.4, google_review_count: null })).toBe(false);
  });

  it('is true only with a positive rating AND a positive review count', () => {
    expect(hasGoogleRating({ google_rating: 4.4, google_review_count: 241 })).toBe(true);
    expect(hasGoogleRating({ google_rating: 1, google_review_count: 1 })).toBe(true);
  });
});

describe('clampGoogleRating', () => {
  it('clamps to the 0–5 range', () => {
    expect(clampGoogleRating(-2)).toBe(0);
    expect(clampGoogleRating(6)).toBe(5);
    expect(clampGoogleRating(4.4)).toBe(4.4);
  });
  it('returns 0 for non-finite input', () => {
    expect(clampGoogleRating(NaN)).toBe(0);
    expect(clampGoogleRating(Infinity)).toBe(0); // non-finite guard returns 0
  });
});

describe('googleStarFillPercent', () => {
  it('maps a rating to a 0–100 fill percentage', () => {
    expect(googleStarFillPercent(5)).toBe(100);
    expect(googleStarFillPercent(4.4)).toBe(88);
    expect(googleStarFillPercent(2.5)).toBe(50);
    expect(googleStarFillPercent(0)).toBe(0);
  });
  it('clamps out-of-range input', () => {
    expect(googleStarFillPercent(7)).toBe(100);
    expect(googleStarFillPercent(-1)).toBe(0);
  });
});

describe('googleAriaLabel', () => {
  it('describes the rating out of 5 on Google', () => {
    expect(googleAriaLabel(4.4)).toBe('Rated 4.4 out of 5 on Google');
    expect(googleAriaLabel(5)).toBe('Rated 5 out of 5 on Google');
  });
});

describe('formatGoogleReviewCount', () => {
  it('pluralizes and groups thousands', () => {
    expect(formatGoogleReviewCount(241)).toBe('241 reviews');
    expect(formatGoogleReviewCount(1)).toBe('1 review');
    expect(formatGoogleReviewCount(1000)).toBe('1,000 reviews');
  });
  it('treats null/zero/negative as 0 reviews', () => {
    expect(formatGoogleReviewCount(null)).toBe('0 reviews');
    expect(formatGoogleReviewCount(undefined)).toBe('0 reviews');
    expect(formatGoogleReviewCount(0)).toBe('0 reviews');
    expect(formatGoogleReviewCount(-5)).toBe('0 reviews');
  });
});

describe('formatGoogleAsOf', () => {
  it('formats a YYYY-MM-DD date as "Mon YYYY" (UTC, no off-by-one)', () => {
    expect(formatGoogleAsOf('2026-06-04')).toBe('Jun 2026');
    expect(formatGoogleAsOf('2026-01-01')).toBe('Jan 2026');
    expect(formatGoogleAsOf('2025-12-31')).toBe('Dec 2025');
  });
  it('returns empty string for missing/invalid input', () => {
    expect(formatGoogleAsOf(null)).toBe('');
    expect(formatGoogleAsOf(undefined)).toBe('');
    expect(formatGoogleAsOf('not-a-date')).toBe('');
  });
});

describe('googlePlaceHref', () => {
  it('prefers the stored place URL', () => {
    expect(
      googlePlaceHref({ google_place_url: 'https://example.com/r', google_place_id: 'abc' })
    ).toBe('https://example.com/r');
  });
  it('falls back to a place_id Maps link', () => {
    expect(googlePlaceHref({ google_place_id: 'ChIJ_abc 123' })).toBe(
      'https://www.google.com/maps/place/?q=place_id:ChIJ_abc%20123'
    );
  });
  it('returns null when neither is present', () => {
    expect(googlePlaceHref({})).toBeNull();
    expect(googlePlaceHref(null)).toBeNull();
    expect(googlePlaceHref({ google_place_url: '   ' })).toBeNull();
  });
});
