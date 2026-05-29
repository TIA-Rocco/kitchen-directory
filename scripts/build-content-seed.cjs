#!/usr/bin/env node
/* Transforms the content-swarm output into idempotent seed SQL.
 * - maps linked_company_slugs -> company UUIDs
 * - normalizes any stray em/en dashes (belt-and-suspenders; agents were told none)
 * - dollar-quotes all text to avoid escaping issues
 * Writes a combined seed file (committed) AND per-statement chunk files (small
 * payloads so each can be applied over MCP without socket errors).
 */
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const SEED = path.join('supabase', 'seed', 'blog_and_category_content.sql');
const CHUNK_DIR = path.join('supabase', 'seed', '_chunks');

const SLUG2ID = {
  'shop-at-stop': 'b68c7c8c-410a-4dca-95bb-350465060c10',
  'russell-hendrix': '806c39a5-e8ef-44bb-b3d8-538253aef2e5',
  'nella-cutlery': '7edb910c-02fe-404e-ba58-68828e6b131f',
  'chefco': 'c89734b3-6b08-4bc3-b87a-88f6c445e904',
  'canada-food-equipment': 'a5ebbe5f-713b-421c-9161-446671587c84',
  'wd-colledge': '1cf6437a-e5d7-44ef-8808-5c3d804a5235',
  'igloo-food-equipment': 'b4850a12-67d7-4103-b145-d0a6037a2aa5',
};

let dashCount = 0;
function clean(s) {
  if (typeof s !== 'string') return s;
  const before = s;
  let out = s.replace(/\s*—\s*/g, ', ').replace(/\s*–\s*/g, '-');
  out = out.replace(/,\s*,/g, ',');
  if (out !== before) dashCount += (before.match(/[—–]/g) || []).length;
  return out;
}
function dollar(s) {
  let tag = 'kd', i = 0;
  while (s.includes('$' + tag + '$')) { i++; tag = 'kd' + i; }
  return '$' + tag + '$' + s + '$' + tag + '$';
}

const raw = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const result = raw.result || raw;
const blogPosts = result.blogPosts || [];
const catRaw = result.categoryCopy && result.categoryCopy.categories
  ? result.categoryCopy.categories
  : (Array.isArray(result.categoryCopy) ? result.categoryCopy : []);

const warnings = [];
const statements = [];

for (const p of blogPosts) {
  if (!p || !p.slug) { warnings.push('blog post missing slug'); continue; }
  const ids = (p.linked_company_slugs || [])
    .map((s) => { const id = SLUG2ID[s]; if (!id) warnings.push(`unknown slug in ${p.slug}: ${s}`); return id; })
    .filter(Boolean);
  const linked = ids.length ? `ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]` : `'{}'::uuid[]`;
  statements.push(
    `insert into blog_posts (title, slug, body, excerpt, category, meta_title, meta_description, linked_companies, status, published_at)\n` +
    `values (\n` +
    `  ${dollar(clean(p.title))},\n` +
    `  ${dollar(p.slug)},\n` +
    `  ${dollar(clean(p.body_markdown || ''))},\n` +
    `  ${dollar(clean(p.excerpt || ''))},\n` +
    `  ${dollar(clean(p.category || 'Buying Guides'))},\n` +
    `  ${dollar(clean(p.meta_title || p.title))},\n` +
    `  ${dollar(clean(p.meta_description || p.excerpt || ''))},\n` +
    `  ${linked}, 'published', now()\n` +
    `)\n` +
    `on conflict (slug) do update set\n` +
    `  title = excluded.title, body = excluded.body, excerpt = excluded.excerpt,\n` +
    `  category = excluded.category, meta_title = excluded.meta_title,\n` +
    `  meta_description = excluded.meta_description, linked_companies = excluded.linked_companies,\n` +
    `  status = excluded.status, updated_at = now();`
  );
}

const catLines = [];
for (const c of catRaw) {
  if (!c || !c.slug) { warnings.push('category missing slug'); continue; }
  const faq = JSON.stringify((c.faqs || []).map((f) => ({ question: clean(f.question), answer: clean(f.answer) })));
  catLines.push(`update service_categories set description = ${dollar(clean(c.description || ''))}, faq = ${dollar(faq)}::jsonb where slug = ${dollar(c.slug)};`);
}

// Combined committed seed
fs.mkdirSync(path.dirname(SEED), { recursive: true });
fs.writeFileSync(SEED, '-- AUTO-GENERATED content seed (swarm-authored, Darcy-reviewed post-publish). Idempotent.\n\n' + statements.join('\n\n') + '\n\n' + catLines.join('\n') + '\n');

// Per-statement chunks for safe MCP application
fs.rmSync(CHUNK_DIR, { recursive: true, force: true });
fs.mkdirSync(CHUNK_DIR, { recursive: true });
statements.forEach((s, i) => fs.writeFileSync(path.join(CHUNK_DIR, `post_${String(i + 1).padStart(2, '0')}.sql`), s + '\n'));
fs.writeFileSync(path.join(CHUNK_DIR, `categories.sql`), catLines.join('\n') + '\n');

console.log(`Blog posts: ${blogPosts.length}, Categories: ${catRaw.length}`);
console.log(`Em/en dashes normalized: ${dashCount}, Warnings: ${warnings.length}`);
warnings.forEach((w) => console.log('  ! ' + w));
console.log(`Combined: ${SEED} (${fs.statSync(SEED).size} bytes); chunks in ${CHUNK_DIR} (${statements.length + 1} files)`);
