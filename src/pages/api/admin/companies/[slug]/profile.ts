export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { normalizeCertifications, normalizeGoogleRating, GOOGLE_RATING_KEYS } from '../../../../../lib/validation';

// Update editable company fields. NOT slug (immutable — public URL + Schema.org
// @id), NOT ranking (own endpoint), NOT deleted_at (delete endpoint).
export const POST: APIRoute = async ({ params, request, locals }) => {
  const { slug } = params;
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;
  if (!slug) return json({ error: 'missing slug' }, 400);

  let body: Record<string, any> = {};
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const update: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    if (!body.name.trim()) return json({ error: 'Company name is required.' }, 400);
    update.name = body.name.trim();
  }
  if (typeof body.description === 'string') {
    if (!body.description.trim()) return json({ error: 'Description is required.' }, 400);
    update.description = body.description.trim();
  }
  if (typeof body.website_url === 'string') update.website_url = body.website_url.trim() || null;
  if (typeof body.phone === 'string') update.phone = body.phone.trim() || null;
  if (typeof body.email === 'string') update.email = body.email.trim() || null;
  if (typeof body.logo_url === 'string') update.logo_url = body.logo_url.trim() || null;
  if (typeof body.is_featured === 'boolean') update.is_featured = body.is_featured;

  if (body.address && typeof body.address === 'object') {
    update.address = {
      street: String(body.address.street ?? '').trim(),
      city: String(body.address.city ?? '').trim(),
      province: String(body.address.province ?? '').trim().toUpperCase(),
      postal: String(body.address.postal ?? '').trim().toUpperCase(),
    };
  }

  if (Array.isArray(body.services)) {
    const { data: cats } = await supabaseAdmin.from('service_categories').select('name');
    const valid = new Set((cats ?? []).map((c) => c.name));
    update.services = body.services.map(String).filter((s: string) => valid.has(s));
  }

  if (body.certifications !== undefined) {
    update.certifications = normalizeCertifications(body.certifications);
  }

  // Attributed Google rating fields (display-only; never enters JSON-LD). Applied
  // as a group when the admin form sends any of them, so a bad match can be
  // hand-corrected or the snapshot refreshed without re-running the script.
  if (GOOGLE_RATING_KEYS.some((k) => k in body)) {
    Object.assign(update, normalizeGoogleRating(body));
  }

  if (Array.isArray(body.faq)) {
    update.faq = body.faq
      .filter((f: any) => f && typeof f.question === 'string' && typeof f.answer === 'string' && f.question.trim() && f.answer.trim())
      .map((f: any) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() }));
  }

  if (Object.keys(update).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const { error } = await supabaseAdmin.from('companies').update(update).eq('slug', slug);
  if (error) {
    console.error('company profile update failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
