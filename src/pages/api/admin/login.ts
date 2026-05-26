export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase-server';

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? '';
  const next = formData.get('next')?.toString() || '/admin';

  // Always return the same response to avoid leaking which emails exist on the allow-list.
  const successRedirect = () => redirect('/admin/login?sent=1', 302);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return successRedirect();
  }

  // Pre-check the admin allow-list. Skip Supabase entirely for non-admins —
  // prevents abuse where attackers spam signInWithOtp to email-bomb arbitrary
  // recipients and pollute auth.users with stub rows.
  const adminEmails = (import.meta.env.ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (!adminEmails.includes(email)) {
    return successRedirect();
  }

  const origin = import.meta.env.PUBLIC_SITE_URL || url.origin;
  const callback = new URL('/admin/auth/callback', origin);
  callback.searchParams.set('next', next);

  const supabase = createSupabaseServerClient(cookies, request);

  // Fire-and-acknowledge: don't surface OTP errors to the client to prevent enumeration.
  try {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callback.toString(),
        // shouldCreateUser:false — admins must be pre-provisioned. The
        // approved_by / rejected_by FKs require auth.users rows to exist,
        // and ADMIN_EMAILS gating means non-admin user records are useless.
        shouldCreateUser: false,
      },
    });
  } catch (err) {
    console.error('signInWithOtp failed:', err);
  }

  return successRedirect();
};
