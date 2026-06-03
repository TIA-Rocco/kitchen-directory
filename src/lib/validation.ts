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
