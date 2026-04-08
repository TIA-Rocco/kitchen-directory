export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  // Honeypot check
  const honeypot = formData.get('website');
  if (honeypot) {
    return redirect('/thank-you', 302);
  }

  const company_id = formData.get('company_id')?.toString().trim();
  const reviewer_name = formData.get('reviewer_name')?.toString().trim();
  const rating = formData.get('rating')?.toString().trim();
  const service_category = formData.get('service_category')?.toString().trim();
  const review_text = formData.get('review_text')?.toString().trim();
  const custom_service = formData.get('custom_service')?.toString().trim() || null;

  // Validate required fields
  if (!company_id) {
    return new Response(JSON.stringify({ error: 'Company is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!reviewer_name) {
    return new Response(JSON.stringify({ error: 'Your name is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!rating) {
    return new Response(JSON.stringify({ error: 'Rating is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return new Response(JSON.stringify({ error: 'Rating must be an integer between 1 and 5.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!service_category) {
    return new Response(JSON.stringify({ error: 'Service category is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!review_text) {
    return new Response(JSON.stringify({ error: 'Review text is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log the submission
  console.log('Review submission received:', {
    company_id,
    reviewer_name,
    rating: ratingNum,
    service_category,
    custom_service,
    review_text,
    submitted_at: new Date().toISOString(),
  });

  return redirect('/thank-you', 302);
};
