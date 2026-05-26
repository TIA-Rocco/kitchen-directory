export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const user = locals.user;
  if (!id || !user) {
    return json({ error: 'unauthorized' }, 401);
  }

  // Promote to companies (DB function handles slug + insert)
  const { data: companyId, error: rpcErr } = await supabaseAdmin.rpc('promote_submission', {
    submission_id: id,
  });
  if (rpcErr) {
    console.error('promote_submission failed:', rpcErr);
    return json({ error: rpcErr.message }, 500);
  }

  // Audit + close submission
  const { error: updErr } = await supabaseAdmin
    .from('supplier_submissions')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (updErr) {
    console.error('submission update failed:', updErr);
    return json({ error: updErr.message }, 500);
  }

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle();

  return json({ ok: true, company_id: companyId, company_slug: company?.slug ?? null });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
