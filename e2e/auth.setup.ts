/**
 * Admin session bootstrap.
 *
 * The admin panel is magic-link only (no password form), so we mint a real
 * Supabase session out-of-band and persist it as Playwright storage state in
 * the exact cookie format `@supabase/ssr` reads (`sb-<ref>-auth-token`).
 *
 * Two supported methods (first one whose creds are present wins):
 *   A. SUPABASE_SERVICE_ROLE_KEY  -> admin.generateLink('magiclink') -> verifyOtp
 *   B. E2E_ADMIN_PASSWORD         -> signInWithPassword
 *
 * If neither is available it writes an EMPTY storage state and the authenticated
 * admin specs skip themselves at runtime (they detect the login redirect). This
 * keeps the suite green-or-skip with zero config, and fully exercised once a
 * credential is supplied. See e2e/README.md.
 *
 * Env:
 *   PUBLIC_SUPABASE_URL        (default: project URL below)
 *   PUBLIC_SUPABASE_ANON_KEY   (default: public anon key below)
 *   E2E_ADMIN_EMAIL            (default: rocco@theinfluenceagency.com)
 *   SUPABASE_SERVICE_ROLE_KEY  (method A)
 *   E2E_ADMIN_PASSWORD         (method B)
 */
import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_STORAGE_STATE } from '../playwright.config';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'https://awksvtteuzrzwazqxxyi.supabase.co';
const ANON_KEY =
  process.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3a3N2dHRldXpyendhenF4eHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDg1NTYsImV4cCI6MjA5MTIyNDU1Nn0._44Ri4d0dJsBGiIIVerEKM1eFNpwwJOwvjas3YZU-fI';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'rocco@theinfluenceagency.com';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const BASE_URL = process.env.BASE_URL || 'https://kitchen-directory.vercel.app';

function writeEmptyState(reason: string) {
  fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });
  fs.writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }, null, 2));
  console.warn(`\n[auth.setup] No admin session minted — ${reason}.\n` + `[auth.setup] Authenticated admin specs will SKIP. See e2e/README.md to enable them.\n`);
}

async function getSessionTokens(): Promise<{ access_token: string; refresh_token: string } | null> {
  // Method A — service role: generate a magic link, then redeem its token for a session.
  if (SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: ADMIN_EMAIL });
    if (error || !data?.properties?.hashed_token) {
      console.warn(`[auth.setup] generateLink failed: ${error?.message ?? 'no hashed_token'}`);
    } else {
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data: verified, error: vErr } = await anon.auth.verifyOtp({
        token_hash: data.properties.hashed_token,
        type: 'email',
      });
      if (vErr || !verified.session) {
        console.warn(`[auth.setup] verifyOtp failed: ${vErr?.message ?? 'no session'}`);
      } else {
        return { access_token: verified.session.access_token, refresh_token: verified.session.refresh_token };
      }
    }
  }

  // Method B — password sign-in (requires the admin user to have a password set).
  if (ADMIN_PASSWORD) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (error || !data.session) {
      console.warn(`[auth.setup] signInWithPassword failed: ${error?.message ?? 'no session'}`);
    } else {
      return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    }
  }

  return null;
}

setup('authenticate admin', async () => {
  if (!SERVICE_ROLE_KEY && !ADMIN_PASSWORD) {
    writeEmptyState('neither SUPABASE_SERVICE_ROLE_KEY nor E2E_ADMIN_PASSWORD is set');
    return;
  }

  const tokens = await getSessionTokens();
  if (!tokens) {
    writeEmptyState('session minting failed (see warnings above)');
    return;
  }

  // Re-encode the session into the cookie chunks @supabase/ssr produces, using
  // the same library the app uses — guarantees the cookie name + format match.
  const captured: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => captured.push(...cookies),
    },
  });
  const { error } = await ssr.auth.setSession(tokens);
  if (error || captured.length === 0) {
    writeEmptyState(`setSession produced no cookies (${error?.message ?? 'empty'})`);
    return;
  }

  const domain = new URL(BASE_URL).hostname;
  const storage = {
    cookies: captured.map((c) => ({
      name: c.name,
      value: c.value,
      domain,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: BASE_URL.startsWith('https'),
      sameSite: 'Lax' as const,
    })),
    origins: [],
  };

  fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });
  fs.writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify(storage, null, 2));
  console.log(`\n[auth.setup] Admin session stored for ${ADMIN_EMAIL} (${captured.length} cookie chunk(s)).\n`);
});
