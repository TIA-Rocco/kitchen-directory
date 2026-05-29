export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';
import {
  isFreeEmailProvider,
  isValidCanadianPostalCode,
  normalizeServices,
  validateFaq,
  parseTurnstileResponse,
  type FaqPair,
} from '../../lib/validation';

const MAX_LOGO_BYTES = 1_000_000; // 1MB
// SVG intentionally excluded — direct nav to an uploaded SVG executes embedded <script>.
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg']);
const RATE_LIMIT_PER_IP_PER_24H = 3;
const STORAGE_BUCKET = 'supplier-logos';

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getClientIp(request: Request): string | null {
  // Vercel sets x-vercel-forwarded-for as the trustworthy client IP.
  // Fall back to the rightmost token of x-forwarded-for (Vercel appends the real client last).
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercel) return vercel.split(',')[0]?.trim() || null;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? null;
  }
  return request.headers.get('x-real-ip')?.trim() || null;
}

async function verifyTurnstile(token: string, ip: string | null): Promise<{ ok: boolean; error?: string }> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (import.meta.env.PROD) {
      console.error('[list-company] TURNSTILE_SECRET_KEY missing in production — refusing submission.');
      return { ok: false, error: 'Bot challenge unavailable. Please contact us directly.' };
    }
    console.warn('[list-company] TURNSTILE_SECRET_KEY not set — skipping Turnstile verification (dev mode).');
    return { ok: true };
  }
  if (!token) return { ok: false, error: 'Missing Turnstile token.' };

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const json = await res.json();
    return { ok: parseTurnstileResponse(json).success };
  } catch (err) {
    console.error('[list-company] Turnstile verify error:', err);
    return { ok: false, error: 'Turnstile verification network error.' };
  }
}

export const POST: APIRoute = async ({ request, redirect, url }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return jsonError('Invalid form submission.', 400);
  }

  // 1. Honeypot — silent redirect
  const honeypot = formData.get('business_fax')?.toString().trim();
  if (honeypot) {
    return redirect('/thank-you?type=submission', 302);
  }

  const ip = getClientIp(request);

  // 2. Turnstile verification
  const turnstileToken = formData.get('cf-turnstile-response')?.toString() ?? '';
  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return jsonError(turnstile.error || 'Bot challenge failed. Please refresh and try again.', 403);
  }

  // 3. Rate limit per IP (uses service-role client — anon has no SELECT policy)
  if (ip) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabaseAdmin
      .from('supplier_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('submitter_ip', ip)
      .gte('created_at', since);
    if (countErr) {
      console.error('[list-company] Rate-limit query error:', countErr);
      // Fail-open on rate-limit query errors to avoid blocking legitimate users.
    } else if ((count ?? 0) >= RATE_LIMIT_PER_IP_PER_24H) {
      return jsonError('Too many submissions from this network in the last 24 hours. Please try again later.', 429);
    }
  }

  // 4. Extract + validate fields
  const get = (k: string) => formData.get(k)?.toString().trim() ?? '';

  const name = get('name');
  const website_url = get('website_url');
  const phone = get('phone');
  const business_email = get('business_email').toLowerCase();
  const street = get('street');
  const city = get('city');
  const province = get('province').toUpperCase();
  const postal = get('postal').toUpperCase();
  const description = get('description');
  const submitted_by_name = get('submitted_by_name');
  const submitted_by_email = get('submitted_by_email').toLowerCase();
  const years_raw = get('years_in_business');
  const certifications_raw = get('certifications');
  const services = normalizeServices(formData.getAll('services').map((s) => s.toString()));

  const required: Record<string, string> = {
    'Company name': name,
    'Website URL': website_url,
    Phone: phone,
    'Business email': business_email,
    'Street address': street,
    City: city,
    Province: province,
    'Postal code': postal,
    Description: description,
    'Your name': submitted_by_name,
    'Your email': submitted_by_email,
  };
  for (const [label, val] of Object.entries(required)) {
    if (!val) return jsonError(`${label} is required.`, 400);
  }
  if (services.length === 0) return jsonError('Please select at least one service.', 400);

  if (description.length < 100 || description.length > 500) {
    return jsonError('Description must be between 100 and 500 characters.', 400);
  }
  if (!isValidCanadianPostalCode(postal)) {
    return jsonError('Postal code must be a valid Canadian format (e.g. A1A 1A1).', 400);
  }
  if (isFreeEmailProvider(business_email)) {
    return jsonError('Please use a business email address (not Gmail, Yahoo, Hotmail, etc).', 400);
  }

  // 5. FAQs (only first required)
  const faqPairs: FaqPair[] = [];
  for (let i = 1; i <= 3; i++) {
    const q = get(`faq_q_${i}`);
    const a = get(`faq_a_${i}`);
    if (q || a) faqPairs.push({ question: q, answer: a });
  }
  const faqCheck = validateFaq(faqPairs);
  if (!faqCheck.valid) return jsonError(faqCheck.error || 'FAQ validation failed.', 400);

  // 6. Optional: years
  let years_in_business: number | null = null;
  if (years_raw) {
    const n = parseInt(years_raw, 10);
    if (!isNaN(n) && n >= 0 && n <= 200) years_in_business = n;
  }

  // 7. Optional: certifications
  const certifications = certifications_raw
    ? certifications_raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // 8. Logo upload (best-effort, never blocks submission)
  let logo_url: string | null = null;
  const logo = formData.get('logo');
  if (logo && logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return jsonError('Logo file is too large. Max 1MB.', 400);
    }
    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      return jsonError('Logo must be a PNG or JPG.', 400);
    }
    try {
      const ext = logo.type === 'image/jpeg' ? 'jpg' : 'png';
      const safeSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'company';
      const path = `${safeSlug}-${crypto.randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await logo.arrayBuffer());
      const { data, error: uploadErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(path, bytes, { contentType: logo.type, upsert: false });
      if (uploadErr) {
        if (import.meta.env.PROD) {
          console.error('[list-company] Logo upload failed in production:', uploadErr.message);
          return jsonError('Logo upload failed. Please try again without a logo or contact us.', 500);
        }
        console.warn('[list-company] Logo upload failed (continuing without logo, dev):', uploadErr.message);
      } else if (data) {
        const { data: pub } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
        logo_url = pub?.publicUrl ?? null;
      }
    } catch (err) {
      console.warn('[list-company] Logo upload exception (continuing without logo):', err);
    }
  }

  // 9. Build payload + insert
  const verification_token = crypto.randomUUID();
  const address = { street, city, province, postal };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('supplier_submissions')
    .insert({
      name,
      website_url,
      phone,
      business_email,
      address,
      services,
      years_in_business,
      certifications,
      description,
      faq: faqPairs,
      logo_url,
      submitted_by_name,
      submitted_by_email,
      submitter_ip: ip,
      verification_token,
      status: 'unverified',
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error('[list-company] Insert error:', insertErr);
    return jsonError('Failed to submit application. Please try again.', 500);
  }

  // 10. Fire verification email (best-effort)
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    const edgeSecret = import.meta.env.EDGE_SHARED_SECRET;
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || url.origin;
    if (supabaseUrl && anonKey) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      };
      if (edgeSecret) headers['x-edge-secret'] = edgeSecret;

      await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: business_email,
          template: 'verification',
          vars: {
            verify_url: `${siteUrl}/api/verify-submission?token=${verification_token}`,
          },
        }),
      });
    } else {
      console.warn('[list-company] Supabase URL/key missing — skipping verification email.');
    }
  } catch (err) {
    console.warn('[list-company] Verification email failed (continuing):', err);
  }

  return redirect('/thank-you?type=submission', 302);
};
