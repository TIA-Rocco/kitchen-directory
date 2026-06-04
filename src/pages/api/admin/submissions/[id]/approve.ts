export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/admin-auth';

export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const user = requireAdmin(locals);
  if (user instanceof Response) return user;
  if (!id) return json({ error: 'missing id' }, 400);

  // Single atomic + idempotent DB function: creates the company (only if not
  // already promoted), flips status to approved, and writes audit cols in one
  // transaction. Re-approving a row returns the existing company (no dup).
  // Accepts unverified/pending/needs_info.
  const { data: companyId, error } = await supabaseAdmin.rpc('approve_submission', {
    p_submission_id: id,
    p_admin_id: user.id,
  });

  if (error) {
    console.error('approve_submission failed:', error);
    const msg = error.message || 'Approval failed.';
    const status = /rejected/i.test(msg) ? 409 : /not found/i.test(msg) ? 404 : 500;
    return json({ error: friendlyMessage(msg) }, status);
  }

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle();

  return json({ ok: true, company_id: companyId, company_slug: company?.slug ?? null });
};

function friendlyMessage(raw: string): string {
  if (/rejected/i.test(raw)) return 'This submission was rejected. Reopen it before approving.';
  if (/not found/i.test(raw)) return 'Submission not found (it may have been removed).';
  return 'Could not approve this submission. Please try again.';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
