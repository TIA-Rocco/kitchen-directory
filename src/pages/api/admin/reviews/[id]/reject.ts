export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const user = locals.user;
  if (!id || !user) return json({ error: 'unauthorized' }, 401);

  const { error } = await supabaseAdmin
    .from('reviews')
    .update({
      status: 'rejected',
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('review reject failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
