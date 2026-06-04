/**
 * Shared validators for the supplier-submission funnel.
 * Pure functions, no side effects, easy to unit-test.
 */

export const FREE_EMAIL_PROVIDERS: ReadonlySet<string> = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.ca',
  'hotmail.com',
  'hotmail.ca',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'live.com',
  'msn.com',
]);

export const ALLOWED_SERVICE_SLUGS: readonly string[] = [
  'design-and-technical-drawings',
  'equipment-financing',
  'equipment-leasing',
  'commercial-equipment-procurement',
  'price-match',
  'account-management',
  'equipment-consulting',
  'restaurant-consulting',
  'installation-services',
];

export function isFreeEmailProvider(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return FREE_EMAIL_PROVIDERS.has(domain);
}

export function isValidCanadianPostalCode(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i.test(input.trim());
}

export function normalizeServices(input: string[], allowed: readonly string[] = ALLOWED_SERVICE_SLUGS): string[] {
  if (!Array.isArray(input)) return [];
  const allowedSet = new Set(allowed);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of input) {
    if (typeof s !== 'string') continue;
    const trimmed = s.trim();
    if (!allowedSet.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Normalize certifications from either an array (admin form sends a parsed
 * array) or a raw comma-separated string (apply form / defensive). Trims,
 * drops blanks, dedupes case-insensitively, and caps the count.
 */
export function normalizeCertifications(input: unknown, max = 20): string[] {
  let parts: string[] = [];
  if (Array.isArray(input)) {
    parts = input.map((c) => (typeof c === 'string' ? c : String(c)));
  } else if (typeof input === 'string') {
    parts = input.split(',');
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    // Clamp per-item length — certifications are short codes/names (CSA, ETL,
    // Health Canada); this guards the public profile against a pathological
    // multi-KB string being stored and rendered verbatim.
    const trimmed = p.trim().slice(0, 100);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

export interface GoogleRatingInput {
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_rating_as_of: string | null;
  google_place_url: string | null;
}

export const GOOGLE_RATING_KEYS: readonly (keyof GoogleRatingInput)[] = [
  'google_place_id',
  'google_rating',
  'google_review_count',
  'google_rating_as_of',
  'google_place_url',
];

function cleanGoogleText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

function cleanGoogleUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 500);
  return /^https?:\/\//i.test(t) ? t : null;
}

function cleanGoogleRatingValue(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(5, Math.max(0, n));
  return Math.round(clamped * 10) / 10; // one decimal, matches numeric(2,1)
}

function cleanGoogleCount(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function cleanGoogleDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : t;
}

/**
 * Normalize the attributed Google rating fields from an admin form payload into
 * a DB-ready object. Display-only data — never enters JSON-LD. Rating clamps to
 * 0–5 (one decimal), count floors to a non-negative int, date must be
 * YYYY-MM-DD, place URL must be http(s). Anything missing/invalid → null.
 */
export function normalizeGoogleRating(body: Record<string, unknown>): GoogleRatingInput {
  return {
    google_place_id: cleanGoogleText(body.google_place_id, 300),
    google_rating: cleanGoogleRatingValue(body.google_rating),
    google_review_count: cleanGoogleCount(body.google_review_count),
    google_rating_as_of: cleanGoogleDate(body.google_rating_as_of),
    google_place_url: cleanGoogleUrl(body.google_place_url),
  };
}

export interface FaqPair {
  question: string;
  answer: string;
}

export function validateFaq(faqs: FaqPair[]): { valid: boolean; error?: string } {
  if (!Array.isArray(faqs) || faqs.length === 0) {
    return { valid: false, error: 'At least one FAQ entry is required.' };
  }
  for (let i = 0; i < faqs.length; i++) {
    const f = faqs[i];
    if (!f || typeof f.question !== 'string' || typeof f.answer !== 'string') {
      return { valid: false, error: `FAQ #${i + 1} is malformed.` };
    }
    if (!f.question.trim() || !f.answer.trim()) {
      return { valid: false, error: `FAQ #${i + 1} must have both a question and an answer.` };
    }
  }
  return { valid: true };
}

export function parseTurnstileResponse(json: unknown): { success: boolean; error?: string } {
  if (!json || typeof json !== 'object') {
    return { success: false, error: 'Invalid Turnstile response.' };
  }
  const obj = json as { success?: unknown; 'error-codes'?: unknown };
  if (obj.success === true) return { success: true };
  let error = 'Turnstile verification failed.';
  if (Array.isArray(obj['error-codes']) && obj['error-codes'].length > 0) {
    error += ' Codes: ' + obj['error-codes'].join(', ');
  }
  return { success: false, error };
}
