export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const user = requireAdmin(locals);
  if (user instanceof Response) return user;
  if (!id) return json({ error: 'missing id' }, 400);

  let body: { notes?: string } = {};
  try {
    body = await request.json();
  } catch { /* empty body OK */ }

  // Append note (if any) to existing internal_notes
  let internalNotes: string | undefined;
  if (body.notes) {
    const { data: existing } = await supabaseAdmin
      .from('supplier_submissions')
      .select('internal_notes')
      .eq('id', id)
      .maybeSingle();
    const prior = existing?.internal_notes ?? '';
    const stamp = `\n\n[${new Date().toISOString()} reject] ${body.notes}`;
    internalNotes = (prior + stamp).trim();
  }

  const update: Record<string, unknown> = {
    status: 'rejected',
    rejected_by: user.id,
    rejected_at: new Date().toISOString(),
  };
  if (internalNotes !== undefined) update.internal_notes = internalNotes;

  const { error } = await supabaseAdmin.from('supplier_submissions').update(update).eq('id', id);
  if (error) {
    console.error('reject failed:', error);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
}
