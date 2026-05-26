// ============================================================================
// send-transactional-email
// ----------------------------------------------------------------------------
// Supabase Edge Function that sends templated plain-text emails via Mailgun.
//
// Invoked by:
//   * pg_net triggers in migration 005 (admin notifications, supplier approval)
//   * Astro server routes (verification email, submission_received receipt)
//
// Request body:
//   {
//     to: string | string[],
//     template: 'verification' | 'submission_received' | 'approved'
//             | 'admin_new_submission' | 'admin_new_review',
//     vars: Record<string, string>
//   }
//
// Auth: optional `x-edge-secret` header validated against EDGE_SHARED_SECRET.
//       If EDGE_SHARED_SECRET is unset, no auth is required (dev mode).
//
// Mailgun: if MAILGUN_API_KEY is unset, returns { ok: true, mocked: true } so
// dev environments without Mailgun provisioned still work end-to-end.
//
// Responses: always 200 unless an internal exception fires (5xx). Mailgun
// validation errors are reported in the JSON body but kept at 200 so pg_net
// does not retry indefinitely.
// ============================================================================

const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || '';
const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || '';
const MAILGUN_FROM =
  Deno.env.get('MAILGUN_FROM') ||
  `Kitchen Equipment Canada <postmaster@${MAILGUN_DOMAIN || 'kitchenequipment.ca'}>`;
const EDGE_SHARED_SECRET = Deno.env.get('EDGE_SHARED_SECRET') || '';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://kitchen-directory.vercel.app';

type TemplateName =
  | 'verification'
  | 'submission_received'
  | 'approved'
  | 'admin_new_submission'
  | 'admin_new_review';

interface RequestBody {
  to: string | string[];
  template: TemplateName;
  vars?: Record<string, string>;
}

interface RenderedEmail {
  subject: string;
  text: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-edge-secret',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function v(vars: Record<string, string> | undefined, key: string): string {
  return (vars && vars[key]) ?? '';
}

function render(template: TemplateName, vars: Record<string, string> | undefined): RenderedEmail {
  switch (template) {
    case 'verification':
      return {
        subject: 'Verify your Kitchen Equipment Canada submission',
        text: `Thanks for applying to be listed on Kitchen Equipment Canada. Please click to verify your email: ${v(
          vars,
          'verify_url',
        )}. Link expires in 48 hours.`,
      };

    case 'submission_received':
      return {
        subject: 'We received your supplier application',
        text: `Thanks! We received your application for ${v(
          vars,
          'company_name',
        )}. We'll review and respond as soon as possible.`,
      };

    case 'approved':
      return {
        subject: `${v(vars, 'company_name') || 'Your company'} is now listed`,
        text: `Great news — ${v(vars, 'company_name')} is now listed at ${v(vars, 'company_url')}.`,
      };

    case 'admin_new_submission':
      return {
        subject: `New supplier submission: ${v(vars, 'company_name')}`,
        text: `New supplier submission ready for review: ${v(
          vars,
          'company_name',
        )}. Review at ${v(vars, 'admin_url')}.`,
      };

    case 'admin_new_review':
      return {
        subject: `New review for ${v(vars, 'company_name')} (${v(vars, 'rating')}★)`,
        text: `New review submitted for ${v(vars, 'company_name')} (${v(
          vars,
          'rating',
        )}★). Moderate at ${v(vars, 'admin_url')}.`,
      };

    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

async function sendOne(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.warn('[send-transactional-email] MAILGUN_API_KEY/DOMAIN unset — mocking send to', to);
    return { ok: true };
  }

  const form = new FormData();
  form.append('from', MAILGUN_FROM);
  form.append('to', to);
  form.append('subject', subject);
  form.append('text', text);

  const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
    },
    body: form,
  });

  if (!res.ok) {
    const error = await res.text();
    return { ok: false, error };
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json(200, { ok: false, error: 'method_not_allowed' });
  }

  // Optional shared-secret check
  if (EDGE_SHARED_SECRET) {
    const provided = req.headers.get('x-edge-secret') || '';
    if (provided !== EDGE_SHARED_SECRET) {
      return json(200, { ok: false, error: 'unauthorized' });
    }
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(200, { ok: false, error: 'invalid_json' });
  }

  const { to, template, vars } = body;
  if (!to || !template) {
    return json(200, { ok: false, error: 'missing_fields' });
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    return json(200, { ok: false, error: 'no_recipients' });
  }

  let rendered: RenderedEmail;
  try {
    rendered = render(template, vars);
  } catch (err) {
    return json(200, { ok: false, error: (err as Error).message });
  }

  // Provide a default verify/site URL when vars are sparse
  if (template === 'verification' && !v(vars, 'verify_url')) {
    return json(200, { ok: false, error: 'missing_verify_url' });
  }

  const results: Array<{ to: string; ok: boolean; error?: string }> = [];
  for (const recipient of recipients) {
    try {
      const result = await sendOne(recipient, rendered.subject, rendered.text);
      results.push({ to: recipient, ...result });
    } catch (err) {
      results.push({ to: recipient, ok: false, error: (err as Error).message });
    }
  }

  const allOk = results.every((r) => r.ok);
  const mocked = !MAILGUN_API_KEY || !MAILGUN_DOMAIN;
  return json(200, { ok: allOk, mocked, results, site_url: SITE_URL });
});
