import { describe, it, expect, afterEach, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isAdminEmail, getAdminEmails, requireAdmin } from '../admin-auth';

// A minimal User stand-in — requireAdmin only reads `.email`.
function userWith(email: string | null): User {
  return { id: 'user-123', email } as unknown as User;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAdminEmails', () => {
  it('parses a comma-separated list, lowercased + trimmed', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Admin@Example.com , Sonia@KE.ca ');
    expect(getAdminEmails()).toEqual(['admin@example.com', 'sonia@ke.ca']);
  });

  it('returns an empty list when unset or blank', () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(getAdminEmails()).toEqual([]);
  });
});

describe('isAdminEmail', () => {
  it('is true for an allow-listed email, case-insensitively', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com,sonia@ke.ca');
    expect(isAdminEmail('admin@example.com')).toBe(true);
    expect(isAdminEmail('ADMIN@example.com')).toBe(true);
    expect(isAdminEmail('Sonia@KE.ca')).toBe(true);
  });

  it('is false for a non-listed email', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    expect(isAdminEmail('attacker@evil.com')).toBe(false);
  });

  it('is false for null/undefined/empty', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });

  it('is false for everyone when the allow-list is empty', () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(isAdminEmail('admin@example.com')).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('returns a 401 Response when there is no user', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    const res = requireAdmin({} as App.Locals);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it('returns a 403 Response when the user is not on the allow-list', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    const res = requireAdmin({ user: userWith('attacker@evil.com') } as App.Locals);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('returns the User when the user is an allow-listed admin', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    const admin = userWith('admin@example.com');
    const res = requireAdmin({ user: admin } as App.Locals);
    expect(res).not.toBeInstanceOf(Response);
    expect((res as User).id).toBe('user-123');
  });

  it('forbids an authenticated user once the allow-list no longer includes them', () => {
    // Defense-in-depth: even a previously-valid session is rejected at the
    // handler if ADMIN_EMAILS changes to exclude them.
    vi.stubEnv('ADMIN_EMAILS', 'someone-else@example.com');
    const res = requireAdmin({ user: userWith('former-admin@example.com') } as App.Locals);
    expect((res as Response).status).toBe(403);
  });
});
