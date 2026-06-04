// Shared helpers for the optimized hero photos used on the homepage and service
// category pages. The source JPGs live in public/heroes/ (and public/heroes/services/);
// scripts/optimize-images.cjs pre-generates responsive AVIF/WebP/JPG variants into
// a sibling `opt/` folder. These helpers build the matching srcset/fallback URLs so
// HeroImage.astro (the <picture>) and Base.astro (the <link rel=preload>) stay in sync.
//
// Kept as a plain .ts helper (not inlined in .astro frontmatter) to dodge the
// @astrojs/compiler tokenizer quirk that mis-parses some expressions in getStaticPaths
// frontmatter — see the note in src/lib/reviews.ts.

export const HERO_WIDTHS = [768, 1280, 1920] as const;

// Nominal intrinsic size for the 16:9 hero photos. The hero <img> is absolutely
// positioned (object-cover, full-bleed) so layout is container-driven and these
// only satisfy the "image elements have explicit width and height" best practice;
// they do not drive layout (CLS stays 0).
export const HERO_WIDTH = 1600;
export const HERO_HEIGHT = 900;

/** `dir` is '' for the homepage hero, 'services/' for service-category banners. */
export function heroSrcset(base: string, dir = '', format: 'avif' | 'webp' = 'avif'): string {
  return HERO_WIDTHS.map((w) => `/heroes/${dir}opt/${base}-${w}.${format} ${w}w`).join(', ');
}

/** Baseline JPG fallback for <picture>'s <img> (older browsers / no AVIF/WebP). */
export function heroFallback(base: string, dir = ''): string {
  return `/heroes/${dir}opt/${base}-1280.jpg`;
}
