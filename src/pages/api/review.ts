export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// Treat the request as an AJAX/fetch submission (return JSON) vs a native
// no-JS form POST (return a redirect on success, a styled HTML page on error —
// never raw JSON in the address bar).
function wantsJson(request: Request): boolean {
  if (request.headers.get('x-requested-with') === 'fetch') return true;
  return (request.headers.get('accept') || '').includes('application/json');
}

function errorPageHtml(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Review not submitted</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#fafafa;color:#171717;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1.5rem}.card{max-width:28rem;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:.75rem;padding:2rem;text-align:center}.card h1{font-size:1.25rem;margin:0 0 .5rem}.card p{color:#525252;margin:0 0 1.5rem}.card a{display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:.625rem 1rem;border-radius:.5rem;font-size:.875rem;font-weight:500}</style>
</head><body><div class="card"><h1>We couldn't submit your review</h1><p>${message}</p><a href="/submit-review">Back to the form</a></div></body></html>`;
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

  // Honeypot — silently accept so bots think they succeeded.
  if (formData.get('website')) {
    return ok(request, redirect);
  }

  const company_id = formData.get('company_id')?.toString().trim();
  const reviewer_name = formData.get('reviewer_name')?.toString().trim();
  const rating = formData.get('rating')?.toString().trim();
  const service_category = formData.get('service_category')?.toString().trim();
  const review_text = formData.get('review_text')?.toString().trim();
  const custom_service = formData.get('custom_service')?.toString().trim() || null;

  if (!company_id) return fail(request, 'Company is required.', 400);
  if (!reviewer_name) return fail(request, 'Your name is required.', 400);
  if (!rating) return fail(request, 'Rating is required.', 400);

  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return fail(request, 'Rating must be an integer between 1 and 5.', 400);
  }
  if (!service_category) return fail(request, 'Service category is required.', 400);
  if (!review_text) return fail(request, 'Review text is required.', 400);

  // Reject reviews for companies that don't exist / have been removed
  // (don't trust a possibly-stale dropdown). Soft-delete filter added with
  // the company-management migration; for now verify the company exists.
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id')
    .eq('id', company_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (companyErr || !company) {
    return fail(request, 'That company is no longer available for reviews.', 400);
  }

  const { error } = await supabase.from('reviews').insert({
    company_id,
    reviewer_name,
    rating: ratingNum,
    service_category,
    custom_service,
    review_text,
  });

  if (error) {
    console.error('Supabase review insert error:', error);
    return fail(request, 'Failed to submit review. Please try again.', 500);
  }

  return ok(request, redirect);
};
