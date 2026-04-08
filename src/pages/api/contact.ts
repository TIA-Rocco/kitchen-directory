export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  // Honeypot check
  const honeypot = formData.get('fax');
  if (honeypot) {
    return redirect('/thank-you', 302);
  }

  const name = formData.get('name')?.toString().trim();
  const email = formData.get('email')?.toString().trim();
  const type = formData.get('type')?.toString().trim();
  const message = formData.get('message')?.toString().trim();
  const company_name = formData.get('company_name')?.toString().trim() || null;

  // Validate required fields
  if (!name) {
    return new Response(JSON.stringify({ error: 'Name is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!type || !['general', 'update_profile'].includes(type)) {
    return new Response(JSON.stringify({ error: 'A valid contact type is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Insert into Supabase
  const { error } = await supabase.from('contact_submissions').insert({
    name,
    email,
    type,
    company_name,
    message,
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return redirect('/thank-you', 302);
};
