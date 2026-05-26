import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

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
 *
 * Lazy-initialized via a Proxy so module load doesn't require the env var.
 * This matters because Astro's prerender phase imports the middleware (which
 * transitively imports this module) even on builds where SUPABASE_SERVICE_ROLE_KEY
 * isn't yet configured — without lazy init, the build hard-fails before
 * static pages can render.
 */
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Configure it in the deployment environment ' +
      'before invoking admin or supplier-submission endpoints.',
    );
  }
  _supabaseAdmin = createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseAdmin;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver);
  },
});
