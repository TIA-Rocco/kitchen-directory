#!/usr/bin/env node
/*
 * fetch-google-ratings.cjs
 * ------------------------------------------------------------------
 * ONE-SHOT snapshot (NOT a pipeline). Pulls each active company's real Google
 * Business Profile rating + review count via the official Google Places API
 * (New) and emits supabase/seed/google_ratings.sql — a reviewable batch of
 * UPDATEs keyed by slug. Run locally, once (and again only to refresh).
 *
 * Why a dated snapshot (not live caching): Google's terms allow storing the
 * place_id indefinitely; the aggregate rating is stored WITH a snapshot date
 * (google_rating_as_of), which is far more ToS-defensible than continuous
 * caching. The rating is shown as ATTRIBUTED third-party data and NEVER fed into
 * the page's own AggregateRating JSON-LD. Full rationale + decisions:
 *   ~/.gstack/projects/KitchenDirectory/google-reviews-build-spec-20260604.md
 *
 * Cost at this scale (~50 companies): ~50 Text Search (Pro, 5k/mo free) + ~50
 * Place Details (Enterprise, 1k/mo free) = $0. Needs a Google Cloud project with
 * a billing account (card required even for free tier) and Places API (New)
 * enabled. DO NOT ship this key to prod — it is for this local script only.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=...           (required)
 *   PUBLIC_SUPABASE_ANON_KEY=...      (required — reads the public company list)
 *   PUBLIC_SUPABASE_URL=...           (optional — defaults to the KE project)
 *
 *   node scripts/fetch-google-ratings.cjs                 # all active companies
 *   node scripts/fetch-google-ratings.cjs --limit=3       # smoke-test a few first
 *   node scripts/fetch-google-ratings.cjs --slug=shop-at-stop-restaurant-supply
 *
 * Then EYEBALL supabase/seed/google_ratings.sql + the LOW-CONFIDENCE report
 * (the data-review gate, spec §6.3) before applying it to prod.
 */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'https://awksvtteuzrzwazqxxyi.supabase.co';
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const limit = getArg('limit') ? parseInt(getArg('limit'), 10) : null;
const onlySlug = getArg('slug');

if (!GOOGLE_KEY) {
  console.error('ERROR: set GOOGLE_MAPS_API_KEY (Places API New, on a billed Google Cloud project).');
  process.exit(1);
}
if (!SUPABASE_ANON_KEY) {
  console.error('ERROR: set PUBLIC_SUPABASE_ANON_KEY (used to read the public company list).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayISO = () => new Date().toISOString().slice(0, 10);

function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// --- normalize names for confidence scoring ----------------------------------
function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,/#!$%^*;:{}=\-_`~()'"]/g, ' ')
    .replace(/\b(inc|ltd|ltée|ltee|co|corp|company|limited|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-overlap confidence in [0,1] between the queried name and Google's. */
function matchConfidence(queryName, foundName) {
  const a = new Set(normName(queryName).split(' ').filter(Boolean));
  const b = new Set(normName(foundName).split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  return overlap / Math.max(a.size, b.size);
}

async function getCompanies() {
  const url = `${SUPABASE_URL}/rest/v1/companies?select=id,slug,name,address,website_url&deleted_at=is.null&order=name.asc`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function textSearch(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      // Pro-tier basic fields only (keep this call on the cheaper SKU).
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, regionCode: 'CA', maxResultCount: 1 }),
  });
  if (!res.ok) throw new Error(`Text Search ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.places && data.places[0]) || null;
}

async function placeDetails(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri',
    },
  });
  if (!res.ok) throw new Error(`Place Details ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  let companies = await getCompanies();
  if (onlySlug) companies = companies.filter((c) => c.slug === onlySlug);
  if (limit) companies = companies.slice(0, limit);
  console.error(`Resolving Google ratings for ${companies.length} companies…\n`);

  const asOf = todayISO();
  const rows = [];      // { company, place, details, confidence }
  const lowConf = [];   // flagged for manual review
  const noMatch = [];   // no place / no rating

  for (const c of companies) {
    const a = c.address || {};
    const queryParts = [c.name, a.street, a.city, a.province].filter(Boolean);
    const query = queryParts.join(', ');
    try {
      const place = await textSearch(query);
      await sleep(150);
      if (!place || !place.id) {
        noMatch.push({ c, reason: 'no Text Search result' });
        console.error(`  ✗ ${c.name} — no match`);
        continue;
      }
      const details = await placeDetails(place.id);
      await sleep(150);

      const foundName = (details.displayName && details.displayName.text) || (place.displayName && place.displayName.text) || '';
      const conf = matchConfidence(c.name, foundName);
      const rating = typeof details.rating === 'number' ? details.rating : null;
      const count = typeof details.userRatingCount === 'number' ? details.userRatingCount : null;

      if (rating === null || !count) {
        noMatch.push({ c, reason: `matched "${foundName}" but no rating/reviews`, place });
        console.error(`  ✗ ${c.name} → "${foundName}" (no rating)`);
        continue;
      }

      const entry = { c, place, details, foundName, conf, rating, count, mapsUri: details.googleMapsUri || null };
      rows.push(entry);
      const flag = conf < 0.5 ? '  ⚠ LOW-CONF' : '';
      if (conf < 0.5) lowConf.push(entry);
      console.error(`  ✓ ${c.name} → "${foundName}" ${rating}★ / ${count}${flag}`);
    } catch (err) {
      noMatch.push({ c, reason: String(err.message || err) });
      console.error(`  ! ${c.name} — error: ${err.message || err}`);
    }
  }

  // --- emit SQL -------------------------------------------------------------
  const out = [];
  out.push('-- google_ratings.sql — GENERATED by scripts/fetch-google-ratings.cjs');
  out.push(`-- Snapshot date: ${asOf}. Attributed third-party data (display-only).`);
  out.push('-- NEVER emitted as the site\'s own AggregateRating/Review JSON-LD.');
  out.push('-- REVIEW the matches below (spec §6.3 data-review gate) before applying.');
  out.push('');
  out.push('begin;');
  out.push('-- Silence the per-row deploy-hook during the bulk load; the merge/deploy');
  out.push('-- (or one manual deploy-hook fire) rebuilds the SSG site once.');
  out.push('alter table public.companies disable trigger trg_company_changed;');
  out.push('');

  for (const r of rows) {
    const placeUrl = `https://search.google.com/local/reviews?placeid=${r.place.id}`;
    const conf = `${Math.round(r.conf * 100)}%`;
    out.push(`-- ${r.c.name}  →  "${r.foundName}"  (${r.rating}★ / ${r.count} reviews, name-match ${conf})`);
    if (r.conf < 0.5) out.push(`--   ⚠ LOW CONFIDENCE — verify this is the right place before applying.`);
    out.push(`update public.companies set`);
    out.push(`  google_place_id = ${sqlStr(r.place.id)},`);
    out.push(`  google_rating = ${r.rating},`);
    out.push(`  google_review_count = ${r.count},`);
    out.push(`  google_rating_as_of = ${sqlStr(asOf)},`);
    out.push(`  google_place_url = ${sqlStr(placeUrl)}`);
    out.push(`where slug = ${sqlStr(r.c.slug)};`);
    out.push('');
  }

  if (noMatch.length) {
    out.push('-- No Google rating found (badge will be omitted — editorial score still shows):');
    for (const n of noMatch) out.push(`--   • ${n.c.name} (${n.c.slug}) — ${n.reason}`);
    out.push('');
  }

  out.push('alter table public.companies enable trigger trg_company_changed;');
  out.push('commit;');
  out.push('');

  const dest = path.join(__dirname, '..', 'supabase', 'seed', 'google_ratings.sql');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out.join('\n'), 'utf8');

  // --- report ---------------------------------------------------------------
  console.error('\n────────────────────────────────────────────────────────');
  console.error(`Matched with rating: ${rows.length}`);
  console.error(`No rating / no match: ${noMatch.length}`);
  if (lowConf.length) {
    console.error(`\n⚠ LOW-CONFIDENCE matches (${lowConf.length}) — verify before applying:`);
    for (const e of lowConf) console.error(`   • ${e.c.name}  →  "${e.foundName}"  (${Math.round(e.conf * 100)}%)`);
  }
  console.error(`\nWrote ${dest}`);
  console.error('Next: review the file (esp. low-confidence rows), then apply to Supabase.');
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
