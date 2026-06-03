import { describe, it, expect } from 'vitest';
import { buildReviewMap, averageRating } from '../reviews';

describe('buildReviewMap', () => {
  it('returns an empty map for null/undefined/empty input', () => {
    expect(buildReviewMap(null).size).toBe(0);
    expect(buildReviewMap(undefined).size).toBe(0);
    expect(buildReviewMap([]).size).toBe(0);
  });

  it('aggregates count and sum per company', () => {
    const map = buildReviewMap([
      { company_id: 'a', rating: 5 },
      { company_id: 'a', rating: 4 },
      { company_id: 'b', rating: 3 },
    ]);
    expect(map.get('a')).toEqual({ count: 2, sum: 9 });
    expect(map.get('b')).toEqual({ count: 1, sum: 3 });
  });
});

describe('averageRating', () => {
  it('returns 0 when there are no reviews', () => {
    expect(averageRating(undefined)).toBe(0);
    expect(averageRating({ count: 0, sum: 0 })).toBe(0);
  });

  it('returns the mean rounded to one decimal place', () => {
    expect(averageRating({ count: 2, sum: 9 })).toBe(4.5);
    expect(averageRating({ count: 3, sum: 10 })).toBe(3.3); // 3.333 -> 3.3
    expect(averageRating({ count: 2, sum: 10 })).toBe(5);
  });
});
