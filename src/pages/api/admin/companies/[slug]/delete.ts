export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

// Soft-delete (default) or restore a company. Soft-delete sets deleted_at so the
// row + its reviews + the submission audit chain are preserved; public SSG
// queries filter `deleted_at is null`. The company-changed trigger fires a
// rebuild so the page drops off / reappears on the live site.
export const POST: APIRoute = async ({ params, request, locals }) => {
  const { slug } = params;
  const auth = requireAdmin(locals);
  if (auth instanceof Response) return auth;
  if (!slug) return json({ error: 'missing slug' }, 400);

  let body: Record<string, any> = {};
  try { body = await request.json(); } catch { /* default = delete */ }
  const restore = body?.action === 'restore';

  const { error } = await supabaseAdmin
    .from('companies')
    .update({ deleted_at: restore ? null : new Date().toISOString() })
    .eq('slug', slug);

  if (error) {
    console.error('company delete/restore failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true, deleted: !restore });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
