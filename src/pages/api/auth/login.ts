// POST /api/auth/login (PRD 4.4): login email + password, set cookie sesi.
import type { APIRoute } from 'astro';
import { hit, isLimited, reset } from '@/lib/api/rate-limit';
import { clientIp, safeAdminRedirect } from '@/lib/api/redirect';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { createServerSupabase, REMEMBER_COOKIE } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validation/auth';

export const prerender = false;

const LIMIT = 5; // PRD F-14: 5 gagal / 15 menit / IP
const WINDOW_MS = 15 * 60_000;

export const POST: APIRoute = async (context) => {
  const key = `login:${clientIp(context)}`;
  const blocked = isLimited(key, LIMIT, WINDOW_MS);
  if (blocked.limited) {
    return fail('RATE_LIMITED', {
      message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
      headers: { 'Retry-After': String(blocked.retryAfter) },
    });
  }

  const parsed = loginSchema.safeParse(await readJson(context.request));
  if (!parsed.success) return validationFail(parsed.error);
  const { email, password, remember = false, redirect } = parsed.data;

  try {
    const supabase = createServerSupabase(context, { sessionOnly: !remember });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      hit(key, LIMIT, WINDOW_MS);
      // Tanpa membedakan penyebab (PRD F-14).
      return fail('UNAUTHORIZED', { message: 'Email atau password salah.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('admin_profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      return fail('FORBIDDEN');
    }

    reset(key);
    if (remember) context.cookies.delete(REMEMBER_COOKIE, { path: '/' });
    else context.cookies.set(REMEMBER_COOKIE, '0', { path: '/', sameSite: 'lax', httpOnly: true });
    return ok({ redirect: safeAdminRedirect(redirect) });
  } catch (error) {
    return internalError(error, 'login');
  }
};
