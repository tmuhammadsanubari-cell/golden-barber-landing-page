// POST /api/auth/logout: hapus sesi dan cookie.
import type { APIRoute } from 'astro';
import { internalError, ok } from '@/lib/api/respond';
import { REMEMBER_COOKIE } from '@/lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ locals, cookies }) => {
  try {
    await locals.supabase.auth.signOut();
    cookies.delete(REMEMBER_COOKIE, { path: '/' });
    return ok({ redirect: '/admin/login' });
  } catch (error) {
    return internalError(error, 'logout');
  }
};
