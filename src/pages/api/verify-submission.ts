export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get('token')?.trim();
  if (!token) {
    return redirect('/verify-submission?status=invalid', 302);
  }

  // Enforce token expiry in-API (independent of the pg_cron purge job,
  // which may not be available on smaller Supabase plans).
  const cutoff = new Date(Date.now() - TOKEN_TTL_MS).toISOString();

  // Atomically claim the row: only update if still 'unverified' AND fresh.
  // Service-role client — anon has no UPDATE policy on supplier_submissions.
  const { data, error } = await supabaseAdmin
    .from('supplier_submissions')
    .update({
      status: 'pending',
      verified_at: new Date().toISOString(),
      verification_token: null,
    })
    .eq('verification_token', token)
    .eq('status', 'unverified')
    .gte('created_at', cutoff)
    .select('id, name, business_email')
    .maybeSingle();

  if (error) {
    console.error('[verify-submission] Update error:', error);
    return redirect('/verify-submission?status=invalid', 302);
  }
  if (!data) {
    return redirect('/verify-submission?status=invalid', 302);
  }

  // Fire submission_received email (best-effort, don't await failure).
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const edgeSecret = import.meta.env.EDGE_SHARED_SECRET;

    if (supabaseUrl && anonKey) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      };
      if (edgeSecret) headers['x-edge-secret'] = edgeSecret;

      // Fire-and-forget; do not block redirect on email delivery.
      fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: data.business_email,
          template: 'submission_received',
          vars: { company_name: data.name },
        }),
      }).catch((err) => console.warn('[verify-submission] Email send failed:', err));
    }
  } catch (err) {
    console.warn('[verify-submission] Email setup error:', err);
  }

  return redirect('/verify-submission?status=ok', 302);
};
