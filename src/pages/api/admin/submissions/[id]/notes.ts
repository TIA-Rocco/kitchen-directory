export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;
  if (!id) return json({ error: 'missing id' }, 400);

  let body: { internal_notes?: unknown } = {};
  try { body = await request.json(); } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (typeof body.internal_notes !== 'string') {
    return json({ error: 'internal_notes must be a string' }, 400);
  }

  const { error } = await supabaseAdmin
    .from('supplier_submissions')
    .update({ internal_notes: body.internal_notes })
    .eq('id', id);
  if (error) {
    console.error('notes save failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
