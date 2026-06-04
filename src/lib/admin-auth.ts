import type { User } from '@supabase/supabase-js';

// Single source of truth for who counts as an admin. Used by both the
// middleware (the primary gate on /admin + /api/admin) and requireAdmin()
// (the per-handler defense-in-depth gate). Keeping the parsing in one place
// means the allow-list can never drift between the two layers.

/** Parse ADMIN_EMAILS (comma-separated) into a lowercased allow-list. */
export function getAdminEmails(): string[] {
  return (import.meta.env.ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
}

/** True iff `email` is on the ADMIN_EMAILS allow-list (case-insensitive). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Defense-in-depth admin gate for /api/admin/* route handlers.
 *
 * The middleware already gates these paths and only populates `locals.user`
 * after verifying the allow-list, so a handler that merely checks
 * `locals.user` is secure today. This re-verifies the allow-list at the
 * handler itself so a single middleware path-match is never the *only* thing
 * standing between an authenticated non-admin and a service-role write.
 *
 * Returns the authenticated admin `User` on success, or a `Response`
 * (401 unauthorized / 403 forbidden) to return early:
 *
 *   const auth = requireAdmin(locals);
 *   if (auth instanceof Response) return auth;
 *   // ...auth is the admin User here
 */
export function requireAdmin(locals: App.Locals): User | Response {
  const user = locals.user;
  if (!user) return jsonError('unauthorized', 401);
  if (!isAdminEmail(user.email)) return jsonError('forbidden', 403);
  return user;
}
