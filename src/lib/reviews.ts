// Shared review-aggregation helpers used by pages that show per-company review
// stats (homepage + service category pages).
//
// NOTE: keep the rounding arithmetic in this .ts module, NOT inline in .astro
// frontmatter. The @astrojs/compiler frontmatter scanner mis-tokenizes the
// `Math.round((sum / count) * 10) / 10` division sequence when it appears deeply
// nested inside getStaticPaths (it works at top level, e.g. index.astro, but
// breaks inside the service page's nested map), emitting a bogus
// "Unexpected export" parse error. Calling a helper sidesteps the scanner bug.

export type ReviewStat = { count: number; sum: number };

/** Aggregate approved reviews into a company_id -> {count, sum} map. */
export function buildReviewMap(
  reviews: { company_id: string; rating: number }[] | null | undefined
): Map<string, ReviewStat> {
  const map = new Map<string, ReviewStat>();
  for (const r of reviews || []) {
    const existing = map.get(r.company_id) || { count: 0, sum: 0 };
    existing.count++;
    existing.sum += r.rating;
    map.set(r.company_id, existing);
  }
  return map;
}

/** Average rating rounded to one decimal place; 0 when there are no reviews. */
export function averageRating(stat: ReviewStat | undefined): number {
  if (!stat || stat.count === 0) return 0;
  return Math.round((stat.sum / stat.count) * 10) / 10;
}
