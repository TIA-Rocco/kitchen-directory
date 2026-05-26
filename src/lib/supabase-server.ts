import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Cookie-aware Supabase client for use in middleware, pages, and API routes.
 * Reads and writes Supabase Auth session cookies so magic-link sessions persist.
 *
 * Uses the modern `getAll`/`setAll` cookie adapter. `getAll` parses the raw
 * Cookie header (Astro's `AstroCookies` has no built-in list-all). `setAll`
 * delegates to `AstroCookies.set` so refreshed tokens land on the response.
 */
export function createSupabaseServerClient(
  cookies: AstroCookies,
  request?: Request,
): SupabaseClient {
  const cookieHeader = request?.headers.get('cookie') ?? '';
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        // Some `parseCookieHeader` builds may emit `value: undefined`; normalize.
        return parseCookieHeader(cookieHeader).map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, { ...options, path: options?.path ?? '/' });
        }
      },
    },
  });
}

/**
 * Service-role client for privileged admin operations: bypasses RLS, calls
 * SECURITY DEFINER functions like promote_submission, writes audit columns
 * regardless of user policy. Never expose to the browser.
 */
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
