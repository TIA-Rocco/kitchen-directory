#!/usr/bin/env node
/*
 * optimize-images.cjs — one-shot, idempotent image optimizer for kitchenequipment.ca.
 *
 * Why: the hero photos (public/heroes/**.jpg, ~230-410 KB each) are the LCP element
 * on the homepage + every /services/[slug] page, and were shipping as raw full-size
 * JPGs with no modern format or responsive sizes — pinning mobile LCP at ~4.5s and
 * PageSpeed mobile in the low 80s. Company logos (public/logos/*.png, up to ~221 KB)
 * render at 48-80px but shipped at full resolution, dragging the company-profile LCP.
 *
 * What it does (run locally, commit the output — NOT part of the Vercel build):
 *   1. Heroes  -> responsive AVIF + WebP + a JPG fallback at widths [768,1280,1920],
 *                 written to a sibling opt/ folder. Originals are left untouched as
 *                 the optimization source-of-truth.
 *   2. Logos   -> resized in place to max 256px wide and recompressed PNG (keeps the
 *                 /logos/<slug>.png URLs, so no DB / logo_url changes needed).
 *
 * Re-running is safe: heroes skip variants that already exist and are newer than the
 * source; logos skip files already within the size cap. Pass --force to regenerate.
 *
 * Usage:  node scripts/optimize-images.cjs [--force] [--heroes-only] [--logos-only]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const HERO_WIDTHS = [768, 1280, 1920];
const LOGO_MAX = 256;

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const HEROES_ONLY = argv.includes('--heroes-only');
const LOGOS_ONLY = argv.includes('--logos-only');

function fmtKB(bytes) {
  return `${Math.round(bytes / 1024)}KB`;
}

function newerThan(target, source) {
  // true if target exists and is at least as new as source
  if (!fs.existsSync(target)) return false;
  return fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs;
}

async function buildHero(srcPath, optDir, base) {
  fs.mkdirSync(optDir, { recursive: true });
  const meta = await sharp(srcPath).metadata();
  let made = 0;
  let bytes = 0;
  for (const w of HERO_WIDTHS) {
    if (w > meta.width) continue; // never upscale
    const variants = [
      { ext: 'avif', opts: { quality: 50, effort: 4 } },
      { ext: 'webp', opts: { quality: 72 } },
      { ext: 'jpg', opts: { quality: 72, mozjpeg: true } },
    ];
    for (const v of variants) {
      const out = path.join(optDir, `${base}-${w}.${v.ext}`);
      if (!FORCE && newerThan(out, srcPath)) {
        bytes += fs.statSync(out).size;
        continue;
      }
      let pipe = sharp(srcPath).resize({ width: w, withoutEnlargement: true });
      if (v.ext === 'avif') pipe = pipe.avif(v.opts);
      else if (v.ext === 'webp') pipe = pipe.webp(v.opts);
      else pipe = pipe.jpeg(v.opts);
      const buf = await pipe.toBuffer();
      fs.writeFileSync(out, buf);
      bytes += buf.length;
      made++;
    }
  }
  console.log(`  hero ${base}: ${made} variants written, ${fmtKB(bytes)} total on disk`);
  return made;
}

async function optimizeHeroes() {
  const targets = [];
  const homeJpg = path.join(PUBLIC, 'heroes', 'home.jpg');
  if (fs.existsSync(homeJpg)) {
    targets.push({ src: homeJpg, optDir: path.join(PUBLIC, 'heroes', 'opt'), base: 'home' });
  }
  const svcDir = path.join(PUBLIC, 'heroes', 'services');
  if (fs.existsSync(svcDir)) {
    for (const f of fs.readdirSync(svcDir)) {
      if (!f.endsWith('.jpg')) continue;
      targets.push({
        src: path.join(svcDir, f),
        optDir: path.join(svcDir, 'opt'),
        base: path.basename(f, '.jpg'),
      });
    }
  }
  console.log(`Heroes: ${targets.length} source images`);
  let total = 0;
  for (const t of targets) total += await buildHero(t.src, t.optDir, t.base);
  console.log(`Heroes done: ${total} variants generated.\n`);
}

async function optimizeLogos() {
  const logoDir = path.join(PUBLIC, 'logos');
  if (!fs.existsSync(logoDir)) return;
  const files = fs.readdirSync(logoDir).filter((f) => f.endsWith('.png'));
  let savedBefore = 0;
  let savedAfter = 0;
  let touched = 0;
  for (const f of files) {
    const p = path.join(logoDir, f);
    const before = fs.statSync(p).size;
    const meta = await sharp(p).metadata();
    const needsResize = meta.width > LOGO_MAX;
    // Skip already-small files unless forced (recompress only when worthwhile).
    if (!FORCE && !needsResize && before < 40 * 1024) {
      savedBefore += before;
      savedAfter += before;
      continue;
    }
    const buf = await sharp(p)
      .resize({ width: LOGO_MAX, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 82, effort: 8 })
      .toBuffer();
    // Only overwrite if we actually shrank it.
    if (buf.length < before) {
      fs.writeFileSync(p, buf);
      savedAfter += buf.length;
      touched++;
    } else {
      savedAfter += before;
    }
    savedBefore += before;
  }
  console.log(
    `Logos: ${touched}/${files.length} recompressed, ${fmtKB(savedBefore)} -> ${fmtKB(savedAfter)} ` +
      `(saved ${fmtKB(savedBefore - savedAfter)})\n`
  );
}

(async () => {
  console.log(`optimize-images: force=${FORCE}\n`);
  if (!LOGOS_ONLY) await optimizeHeroes();
  if (!HEROES_ONLY) await optimizeLogos();
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
