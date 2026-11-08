// POST /api/auth/set-session: jembatan tautan undangan admin. Supabase mengirim undangan dengan
// token di fragmen URL (#access_token=…), yang tidak terbaca server. Halaman /admin/reset-password
// membacanya di browser lalu mengirim kedua token ke sini; Supabase memverifikasinya dan sesi
// disimpan sebagai cookie biasa. Token yang tidak valid ditolak oleh Supabase.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';

export const prerender = false;

const bodySchema = z.object({
  access_token: z.string().min(20).max(4096),
  refresh_token: z.string().min(5).max(512),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    const { data, error } = await locals.supabase.auth.setSession(parsed.data);
    if (error || !data.session) {
      return fail('UNAUTHORIZED', {
        message: 'Tautan undangan sudah kedaluwarsa atau sudah dipakai. Minta undangan baru ke Super Admin.',
      });
    }
    return ok({ redirect: '/admin/reset-password' });
  } catch (error) {
    return internalError(error, 'auth/set-session');
  }
};
