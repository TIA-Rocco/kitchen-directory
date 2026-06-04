import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';
import { isAdminEmail } from './lib/admin-auth';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/auth/callback', '/api/admin/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdminPage = path.startsWith('/admin');
  const isAdminApi = path.startsWith('/api/admin');

  if (!isAdminPage && !isAdminApi) return next();
  if (PUBLIC_ADMIN_PATHS.has(path)) return next();

  const supabase = createSupabaseServerClient(context.cookies, context.request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isAdminApi) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/admin/login?next=' + encodeURIComponent(path));
  }

  if (!isAdminEmail(user.email)) {
    if (isAdminApi) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Forbidden: your email is not on the admin allow-list.', { status: 403 });
  }

  context.locals.user = user;
  context.locals.supabase = supabase;
  return next();
});
