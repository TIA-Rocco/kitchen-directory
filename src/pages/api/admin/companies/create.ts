export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// Manually create a company (admin "New company"), independent of the
// self-submission flow. Slug auto-generated + uniquified by the DB function.
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, any> = {};
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  if (!name) return json({ error: 'Company name is required.' }, 400);
  if (!description) return json({ error: 'Description is required.' }, 400);

  const { data: cats } = await supabaseAdmin.from('service_categories').select('name');
  const valid = new Set((cats ?? []).map((c) => c.name));
  const services = Array.isArray(body.services)
    ? body.services.map(String).filter((s: string) => valid.has(s))
    : [];

  const faq = Array.isArray(body.faq)
    ? body.faq
        .filter((f: any) => f && typeof f.question === 'string' && typeof f.answer === 'string' && f.question.trim() && f.answer.trim())
        .map((f: any) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() }))
    : [];

  const address = {
    street: String(body.address?.street ?? '').trim(),
    city: String(body.address?.city ?? '').trim(),
    province: String(body.address?.province ?? '').trim().toUpperCase(),
    postal: String(body.address?.postal ?? '').trim().toUpperCase(),
  };

  const { data: slug, error: slugErr } = await supabaseAdmin.rpc('generate_unique_company_slug', { base_name: name });
  if (slugErr || !slug) {
    console.error('slug generation failed:', slugErr);
    return json({ error: 'Could not generate a slug for this company.' }, 500);
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('companies')
    .insert({
      name,
      slug,
      description,
      website_url: String(body.website_url ?? '').trim() || null,
      phone: String(body.phone ?? '').trim() || null,
      email: String(body.email ?? '').trim() || null,
      logo_url: String(body.logo_url ?? '').trim() || null,
      address,
      services,
      faq,
      is_featured: body.is_featured === true,
      ranking_breakdown: {
        service_range: 0, customer_reviews: 0, industry_experience: 0,
        response_time: 0, pricing_transparency: 0, certifications: 0,
      },
    })
    .select('slug')
    .single();

  if (error || !inserted) {
    console.error('company create failed:', error);
    return json({ error: error?.message || 'Create failed.' }, 500);
  }
  return json({ ok: true, slug: inserted.slug });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
