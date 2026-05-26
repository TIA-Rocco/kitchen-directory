export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const user = locals.user;
  if (!id || !user) return json({ error: 'unauthorized' }, 401);

  let body: { notes?: string } = {};
  try { body = await request.json(); } catch { /* empty */ }

  let internalNotes: string | undefined;
  if (body.notes) {
    const { data: existing } = await supabaseAdmin
      .from('supplier_submissions')
      .select('internal_notes')
      .eq('id', id)
      .maybeSingle();
    const prior = existing?.internal_notes ?? '';
    const stamp = `\n\n[${new Date().toISOString()} needs_info] ${body.notes}`;
    internalNotes = (prior + stamp).trim();
  }

  // Reuse approved_by/approved_at slot? No — leave audit cols alone for needs_info.
  const update: Record<string, unknown> = { status: 'needs_info' };
  if (internalNotes !== undefined) update.internal_notes = internalNotes;

  const { error } = await supabaseAdmin.from('supplier_submissions').update(update).eq('id', id);
  if (error) {
    console.error('needs-info failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
