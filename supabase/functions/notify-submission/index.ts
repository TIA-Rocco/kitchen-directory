// Supabase Edge Function: Send email notification via Mailgun
// Triggered by database webhook on new review or contact submission

const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || '';
const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'kitchenequipment.ca';
const NOTIFY_EMAIL = 'info@kitchenequipment.ca';

interface WebhookPayload {
  type: 'INSERT';
  table: 'reviews' | 'contact_submissions';
  record: Record<string, unknown>;
  schema: 'public';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload: WebhookPayload = await req.json();
  const { table, record } = payload;

  let subject = '';
  let body = '';

  if (table === 'reviews') {
    subject = `New Review Pending Moderation - ${record.service_category}`;
    body = [
      `A new review has been submitted and is awaiting moderation.`,
      ``,
      `Reviewer: ${record.reviewer_name}`,
      `Rating: ${record.rating}/5`,
      `Service: ${record.service_category}${record.custom_service ? ` (${record.custom_service})` : ''}`,
      ``,
      `Review:`,
      `${record.review_text}`,
      ``,
      `Log in to the Supabase dashboard to approve or reject this review.`,
    ].join('\n');
  } else if (table === 'contact_submissions') {
    const contactType = record.type === 'update_profile' ? 'Profile Update Request' : 'General Inquiry';
    subject = `New Contact Form: ${contactType}`;
    body = [
      `A new contact form submission was received.`,
      ``,
      `Type: ${contactType}`,
      `Name: ${record.name}`,
      `Email: ${record.email}`,
      record.company_name ? `Company: ${record.company_name}` : '',
      ``,
      `Message:`,
      `${record.message}`,
    ].filter(Boolean).join('\n');
  } else {
    return new Response('Unknown table', { status: 400 });
  }

  // Send via Mailgun
  const mailgunUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;
  const formData = new FormData();
  formData.append('from', `Kitchen Equipment Canada <noreply@${MAILGUN_DOMAIN}>`);
  formData.append('to', NOTIFY_EMAIL);
  formData.append('subject', subject);
  formData.append('text', body);

  const response = await fetch(mailgunUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Mailgun error:', error);
    return new Response(JSON.stringify({ error: 'Email send failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
