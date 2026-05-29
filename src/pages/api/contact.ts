export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// AJAX/fetch submission (JSON) vs native no-JS POST (redirect on success,
// styled HTML on error — never raw JSON in the address bar).
function wantsJson(request: Request): boolean {
  if (request.headers.get('x-requested-with') === 'fetch') return true;
  return (request.headers.get('accept') || '').includes('application/json');
}

function errorPageHtml(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Message not sent</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#fafafa;color:#171717;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1.5rem}.card{max-width:28rem;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:.75rem;padding:2rem;text-align:center}.card h1{font-size:1.25rem;margin:0 0 .5rem}.card p{color:#525252;margin:0 0 1.5rem}.card a{display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:.625rem 1rem;border-radius:.5rem;font-size:.875rem;font-weight:500}</style>
</head><body><div class="card"><h1>We couldn't send your message</h1><p>${message}</p><a href="/contact">Back to the form</a></div></body></html>`;
}

function fail(request: Request, message: string, status: number): Response {
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(errorPageHtml(message), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function ok(request: Request, redirect: (path: string, status?: number) => Response): Response {
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: true, redirect: '/thank-you' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return redirect('/thank-you', 302);
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  // Honeypot — silently accept.
  if (formData.get('fax')) {
    return ok(request, redirect);
  }

  const name = formData.get('name')?.toString().trim();
  const email = formData.get('email')?.toString().trim();
  const type = formData.get('type')?.toString().trim();
  const message = formData.get('message')?.toString().trim();
  const company_name = formData.get('company_name')?.toString().trim() || null;

  if (!name) return fail(request, 'Name is required.', 400);
  if (!email) return fail(request, 'Email is required.', 400);
  if (!type || !['general', 'update_profile'].includes(type)) {
    return fail(request, 'Please choose a valid reason for contact.', 400);
  }
  if (!message) return fail(request, 'Message is required.', 400);

  const { error } = await supabase.from('contact_submissions').insert({
    name,
    email,
    type,
    company_name,
    message,
  });

  if (error) {
    console.error('Supabase contact insert error:', error);
    return fail(request, 'Failed to submit. Please try again.', 500);
  }

  return ok(request, redirect);
};
