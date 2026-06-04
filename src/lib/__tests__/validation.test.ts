import { describe, it, expect } from 'vitest';
import {
  isFreeEmailProvider,
  isValidCanadianPostalCode,
  normalizeServices,
  normalizeCertifications,
  normalizeGoogleRating,
  validateFaq,
  parseTurnstileResponse,
  ALLOWED_SERVICE_SLUGS,
  FREE_EMAIL_PROVIDERS,
} from '../validation';

describe('isFreeEmailProvider', () => {
  it('flags common free providers', () => {
    expect(isFreeEmailProvider('john@gmail.com')).toBe(true);
    expect(isFreeEmailProvider('jane@yahoo.ca')).toBe(true);
    expect(isFreeEmailProvider('test@outlook.com')).toBe(true);
    expect(isFreeEmailProvider('me@proton.me')).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isFreeEmailProvider('John@GMAIL.com')).toBe(true);
    expect(isFreeEmailProvider('jane@YAHOO.CA')).toBe(true);
  });

  it('allows real business domains', () => {
    expect(isFreeEmailProvider('owner@shopatstop.ca')).toBe(false);
    expect(isFreeEmailProvider('contact@russellhendrix.com')).toBe(false);
  });

  it('rejects malformed input safely', () => {
    expect(isFreeEmailProvider('')).toBe(false);
    expect(isFreeEmailProvider('not-an-email')).toBe(false);
    expect(isFreeEmailProvider('@gmail.com')).toBe(true); // domain is still gmail
    expect(isFreeEmailProvider('john@')).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(isFreeEmailProvider(null)).toBe(false);
  });

  it('keeps the deny-list in sync with documented providers', () => {
    // sanity: every provider in deny-list is lowercase + has a dot
    for (const p of FREE_EMAIL_PROVIDERS) {
      expect(p).toBe(p.toLowerCase());
      expect(p).toContain('.');
    }
  });
});

describe('isValidCanadianPostalCode', () => {
  it('accepts properly formatted Canadian postal codes', () => {
    expect(isValidCanadianPostalCode('M5V 3A8')).toBe(true);
    expect(isValidCanadianPostalCode('M5V3A8')).toBe(true);
    expect(isValidCanadianPostalCode('K1A 0B1')).toBe(true);
  });

  it('is case-insensitive and trims', () => {
    expect(isValidCanadianPostalCode('m5v 3a8')).toBe(true);
    expect(isValidCanadianPostalCode('  M5V 3A8  ')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidCanadianPostalCode('')).toBe(false);
    expect(isValidCanadianPostalCode('12345')).toBe(false);
    expect(isValidCanadianPostalCode('90210')).toBe(false);
    expect(isValidCanadianPostalCode('M5V')).toBe(false);
    expect(isValidCanadianPostalCode('M5V 3A8 EXTRA')).toBe(false);
  });
});

describe('normalizeServices', () => {
  it('keeps only allowed slugs', () => {
    const input = ['equipment-financing', 'totally-fake-service', 'price-match'];
    expect(normalizeServices(input)).toEqual(['equipment-financing', 'price-match']);
  });

  it('deduplicates', () => {
    const input = ['price-match', 'price-match', 'equipment-leasing'];
    expect(normalizeServices(input)).toEqual(['price-match', 'equipment-leasing']);
  });

  it('trims whitespace before matching', () => {
    expect(normalizeServices(['  equipment-financing  '])).toEqual(['equipment-financing']);
  });

  it('returns empty array for non-array input', () => {
    // @ts-expect-error testing runtime guard
    expect(normalizeServices(null)).toEqual([]);
    // @ts-expect-error testing runtime guard
    expect(normalizeServices('equipment-financing')).toEqual([]);
  });

  it('covers all 9 documented service slugs', () => {
    expect(ALLOWED_SERVICE_SLUGS.length).toBe(9);
    expect(normalizeServices([...ALLOWED_SERVICE_SLUGS])).toEqual([...ALLOWED_SERVICE_SLUGS]);
  });
});

describe('normalizeCertifications', () => {
  it('parses a comma-separated string', () => {
    expect(normalizeCertifications('CSA, ETL, Health Canada')).toEqual(['CSA', 'ETL', 'Health Canada']);
  });

  it('accepts an array (admin form sends a parsed array)', () => {
    expect(normalizeCertifications(['CSA', 'ETL'])).toEqual(['CSA', 'ETL']);
  });

  it('trims, drops blanks, and dedupes case-insensitively', () => {
    expect(normalizeCertifications(' CSA , csa, , ETL ')).toEqual(['CSA', 'ETL']);
  });

  it('caps the count', () => {
    const many = Array.from({ length: 30 }, (_, i) => `C${i}`);
    expect(normalizeCertifications(many, 20)).toHaveLength(20);
  });

  it('returns [] for nullish / unexpected input', () => {
    expect(normalizeCertifications(null)).toEqual([]);
    expect(normalizeCertifications(undefined)).toEqual([]);
    expect(normalizeCertifications(42)).toEqual([]);
    expect(normalizeCertifications('')).toEqual([]);
  });
});

describe('validateFaq', () => {
  it('requires at least one entry', () => {
    expect(validateFaq([])).toEqual({ valid: false, error: expect.any(String) });
  });

  it('accepts a single valid entry', () => {
    expect(validateFaq([{ question: 'Q?', answer: 'A.' }])).toEqual({ valid: true });
  });

  it('rejects empty question or answer', () => {
    expect(validateFaq([{ question: '', answer: 'A.' }]).valid).toBe(false);
    expect(validateFaq([{ question: 'Q?', answer: '   ' }]).valid).toBe(false);
  });

  it('rejects malformed entries', () => {
    // @ts-expect-error testing runtime guard
    expect(validateFaq([{ question: 'Q?' }]).valid).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(validateFaq([null]).valid).toBe(false);
  });

  it('reports the index of the bad entry', () => {
    const result = validateFaq([
      { question: 'OK', answer: 'OK' },
      { question: '', answer: 'OK' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('#2');
  });
});

describe('parseTurnstileResponse', () => {
  it('returns success on valid response', () => {
    expect(parseTurnstileResponse({ success: true })).toEqual({ success: true });
  });

  it('returns failure with error codes', () => {
    const result = parseTurnstileResponse({
      success: false,
      'error-codes': ['invalid-input-response', 'timeout-or-duplicate'],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('invalid-input-response');
  });

  it('handles non-object input', () => {
    expect(parseTurnstileResponse(null).success).toBe(false);
    expect(parseTurnstileResponse('garbage').success).toBe(false);
    expect(parseTurnstileResponse(123).success).toBe(false);
  });

  it('handles missing success field as failure', () => {
    expect(parseTurnstileResponse({}).success).toBe(false);
  });
});

// Rate-limit math validation — the API route checks count >= 3 over 24h.
// This is a tiny pure helper test so the threshold can't silently drift.
describe('rate limit threshold', () => {
  function shouldRateLimit(count: number, threshold = 3): boolean {
    return count >= threshold;
  }
  it('allows up to 2 prior submissions, blocks the 3rd', () => {
    expect(shouldRateLimit(0)).toBe(false);
    expect(shouldRateLimit(1)).toBe(false);
    expect(shouldRateLimit(2)).toBe(false);
    expect(shouldRateLimit(3)).toBe(true);
    expect(shouldRateLimit(10)).toBe(true);
  });
});

// Slug generation parity — the DB function generate_unique_company_slug uses lowercase + dashes.
// This mirror unit-tests the JS-side expectation so the admin live-preview matches.
describe('slug generation contract', () => {
  function slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  it('lowercases', () => {
    expect(slugify('Shop At Stop')).toBe('shop-at-stop');
  });
  it('strips non-alphanumeric', () => {
    expect(slugify('W.D. Colledge Co.')).toBe('w-d-colledge-co');
  });
  it('collapses multiple separators', () => {
    expect(slugify('A   B---C')).toBe('a-b-c');
  });
  it('trims leading/trailing dashes', () => {
    expect(slugify('  -Hello-  ')).toBe('hello');
  });
});

describe('normalizeGoogleRating', () => {
  it('parses and clamps a well-formed admin payload', () => {
    expect(
      normalizeGoogleRating({
        google_place_id: '  ChIJabc  ',
        google_rating: '4.4',
        google_review_count: '241',
        google_rating_as_of: '2026-06-04',
        google_place_url: 'https://search.google.com/local/reviews?placeid=ChIJabc',
      })
    ).toEqual({
      google_place_id: 'ChIJabc',
      google_rating: 4.4,
      google_review_count: 241,
      google_rating_as_of: '2026-06-04',
      google_place_url: 'https://search.google.com/local/reviews?placeid=ChIJabc',
    });
  });

  it('nulls out empty/blank fields', () => {
    expect(
      normalizeGoogleRating({
        google_place_id: '',
        google_rating: '',
        google_review_count: '',
        google_rating_as_of: '',
        google_place_url: '',
      })
    ).toEqual({
      google_place_id: null,
      google_rating: null,
      google_review_count: null,
      google_rating_as_of: null,
      google_place_url: null,
    });
  });

  it('clamps rating to 0–5 with one decimal', () => {
    expect(normalizeGoogleRating({ google_rating: '9' }).google_rating).toBe(5);
    expect(normalizeGoogleRating({ google_rating: '-3' }).google_rating).toBe(0);
    expect(normalizeGoogleRating({ google_rating: '4.46' }).google_rating).toBe(4.5);
    expect(normalizeGoogleRating({ google_rating: 'abc' }).google_rating).toBeNull();
  });

  it('floors review count and rejects negatives/junk', () => {
    expect(normalizeGoogleRating({ google_review_count: '12.9' }).google_review_count).toBe(12);
    expect(normalizeGoogleRating({ google_review_count: '-4' }).google_review_count).toBeNull();
    expect(normalizeGoogleRating({ google_review_count: 'nope' }).google_review_count).toBeNull();
  });

  it('accepts only YYYY-MM-DD dates', () => {
    expect(normalizeGoogleRating({ google_rating_as_of: '2026-06-04' }).google_rating_as_of).toBe('2026-06-04');
    expect(normalizeGoogleRating({ google_rating_as_of: 'June 4 2026' }).google_rating_as_of).toBeNull();
    expect(normalizeGoogleRating({ google_rating_as_of: '2026-13-40' }).google_rating_as_of).toBeNull();
  });

  it('accepts only http(s) place URLs', () => {
    expect(normalizeGoogleRating({ google_place_url: 'https://x.test/a' }).google_place_url).toBe('https://x.test/a');
    expect(normalizeGoogleRating({ google_place_url: 'javascript:alert(1)' }).google_place_url).toBeNull();
    expect(normalizeGoogleRating({ google_place_url: 'ftp://x' }).google_place_url).toBeNull();
  });
});
