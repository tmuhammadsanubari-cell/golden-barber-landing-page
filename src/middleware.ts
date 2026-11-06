// Middleware (PRD 4.4). Halaman publik (/, /cabang/*, aset) lewat tanpa pemeriksaan sesi dan
// tanpa membaca header, jadi tetap statis. Hanya /admin/* dan /api/* yang diproses di sini.
import { defineMiddleware } from 'astro:middleware';
import { fail, internalError } from '@/lib/api/respond';
import { env } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import type { AdminProfile } from '@/types/admin';

/** Halaman admin yang boleh dibuka tanpa sesi. */
const PUBLIC_ADMIN_PAGES = new Set(['/admin/login', '/admin/reset-password']);

/** Endpoint /api/auth/* yang butuh sesi. Login, lupa & reset password tidak. */
const SESSION_AUTH_ENDPOINTS = new Set(['/api/auth/me', '/api/auth/logout']);

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** Origin permintaan harus sama dengan situs ini atau PUBLIC_SITE_URL (perlindungan CSRF). */
function originAllowed(request: Request, requestOrigin: string): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([requestOrigin]);
  const site = env('PUBLIC_SITE_URL');
  if (site) {
    try {
      allowed.add(new URL(site).origin);
    } catch {
      // PUBLIC_SITE_URL tidak valid: abaikan, hanya origin permintaan yang berlaku.
    }
  }
  return allowed.has(origin);
}

const forbiddenPage = () =>
  new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Akses ditolak — Golden Barber</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#2b2f2f"><h1 style="font-size:24px">403 — Akses ditolak</h1><p>Anda tidak memiliki akses ke halaman ini.</p><p><a href="/admin" style="color:#1f6497">Kembali ke dashboard</a></p></body></html>`,
    {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );

export const onRequest = defineMiddleware(async (context, next) => {
  const path = trimSlash(context.url.pathname);
  const isApi = path.startsWith('/api/');
  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  if (!isApi && !isAdminPage) return next();

  if (isApi && UNSAFE_METHODS.has(context.request.method)) {
    if (!originAllowed(context.request, context.url.origin)) {
      return fail('FORBIDDEN', { message: 'Permintaan ditolak: asal permintaan tidak cocok.' });
    }
  }

  const supabase = createServerSupabase(context);
  context.locals.supabase = supabase;
  context.locals.admin = null;

  const needsSession = isAdminPage
    ? !PUBLIC_ADMIN_PAGES.has(path)
    : path.startsWith('/api/admin/') || SESSION_AUTH_ENDPOINTS.has(path);
  // Halaman login/reset juga memuat sesi bila ada, agar admin yang sudah login diarahkan ke dashboard.
  const hasSessionCookie = (context.request.headers.get('cookie') ?? '').includes('sb-');

  let signedIn = false;
  if (hasSessionCookie || needsSession) {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = error ? null : data.user;
      if (user) {
        signedIn = true;
        const { data: profile, error: profileError } = await supabase
          .from('admin_profiles')
          .select('id, full_name, email, role, is_active')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.is_active) {
          const admin: AdminProfile = {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
          };
          context.locals.admin = admin;
        }
      }
    } catch (error) {
      if (needsSession) return isApi ? internalError(error, 'middleware') : forbiddenPage();
      console.error('[middleware] gagal memuat sesi', error);
    }
  }

  if (needsSession && !context.locals.admin) {
    if (isApi) return fail(signedIn ? 'FORBIDDEN' : 'UNAUTHORIZED');
    if (signedIn) {
      // Login tapi bukan admin aktif: hapus sesi lalu tolak.
      await supabase.auth.signOut({ scope: 'local' });
      return forbiddenPage();
    }
    const target = `${context.url.pathname}${context.url.search}`;
    return context.redirect(`/admin/login?redirect=${encodeURIComponent(target)}`);
  }

  const response = await next();
  // Halaman & API admin tidak boleh di-cache oleh browser/proxy.
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
