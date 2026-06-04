export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

const KEYS = [
  'service_range',
  'customer_reviews',
  'industry_experience',
  'response_time',
  'pricing_transparency',
  'certifications',
] as const;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { slug } = params;
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;
  if (!slug) return json({ error: 'missing slug' }, 400);

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const breakdown: Record<string, number> = {};
  for (const k of KEYS) {
    const v = Number(body[k]);
    if (!Number.isFinite(v) || v < 0 || v > 10) {
      return json({ error: `${k} must be a number between 0 and 10` }, 400);
    }
    breakdown[k] = Math.round(v * 10) / 10;
  }

  const { error } = await supabaseAdmin
    .from('companies')
    .update({ ranking_breakdown: breakdown })
    .eq('slug', slug);
  if (error) {
    console.error('ranking update failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
