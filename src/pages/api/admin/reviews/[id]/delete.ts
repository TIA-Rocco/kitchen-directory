export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

// Permanently remove a review (hard delete). Used by admins to purge spam /
// test reviews, including ones that were already approved. If the review was
// approved (live), the DB trigger trg_review_deleted -> notify_review_unpublished()
// fires the Vercel deploy hook so the public profile + AggregateRating drop it
// on the next rebuild. Reviews are anonymous testimonials with no reply
// channel, so there is nothing to soft-retain -- a hard delete is the right
// "remove" semantics here.
export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;
  if (!id) return json({ error: 'missing id' }, 400);

  const { error } = await supabaseAdmin.from('reviews').delete().eq('id', id);
  if (error) {
    console.error('review delete failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
