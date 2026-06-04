export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

// Move a rejected review back to 'pending' so it can be re-moderated and
// approved (recovery path — no more hand-editing Supabase). Mirrors the
// supplier-submission reopen flow.
export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;
  if (!id) return json({ error: 'missing id' }, 400);

  const { error } = await supabaseAdmin
    .from('reviews')
    .update({ status: 'pending', rejected_by: null, rejected_at: null })
    .eq('id', id);

  if (error) {
    console.error('review reopen failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
