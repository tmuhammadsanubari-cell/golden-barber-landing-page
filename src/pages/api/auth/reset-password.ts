// POST /api/auth/reset-password: simpan password baru. Sesi berasal dari tautan reset yang
// sudah ditukar (exchangeCodeForSession) di halaman /admin/reset-password.
import type { APIRoute } from 'astro';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { resetPasswordSchema } from '@/lib/validation/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = resetPasswordSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);

  try {
    const { data } = await locals.supabase.auth.getUser();
    if (!data.user) {
      return fail('UNAUTHORIZED', {
        message: 'Tautan reset sudah kedaluwarsa. Minta tautan baru dari halaman login.',
      });
    }
    const { error } = await locals.supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      return fail('VALIDATION_ERROR', {
        details: { password: 'Password baru ditolak. Coba password lain.' },
      });
    }
    return ok({ redirect: '/admin' });
  } catch (error) {
    return internalError(error, 'reset-password');
  }
};
