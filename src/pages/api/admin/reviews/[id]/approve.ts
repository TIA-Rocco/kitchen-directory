export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const user = requireAdmin(locals);
  if (user instanceof Response) return user;
  if (!id) return json({ error: 'missing id' }, 400);

  const { error } = await supabaseAdmin
    .from('reviews')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('review approve failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
