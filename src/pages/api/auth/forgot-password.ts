// POST /api/auth/forgot-password: kirim email reset password lewat Supabase.
// Selalu membalas sukses agar tidak membocorkan email mana yang terdaftar.
import type { APIRoute } from 'astro';
import { hit } from '@/lib/api/rate-limit';
import { clientIp } from '@/lib/api/redirect';
import { fail, ok, readJson, validationFail } from '@/lib/api/respond';
import { forgotPasswordSchema } from '@/lib/validation/auth';

export const prerender = false;

const SENT = { message: 'Jika email terdaftar, tautan reset password sudah dikirim.' };

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const parsed = forgotPasswordSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);

  const limited = hit(`forgot:${clientIp({ clientAddress })}`, 3, 15 * 60_000);
  if (limited.limited) {
    return fail('RATE_LIMITED', { headers: { 'Retry-After': String(limited.retryAfter) } });
  }

  const { error } = await locals.supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${new URL(request.url).origin}/admin/reset-password`,
  });
  if (error) console.error('[api] forgot-password', error.message);
  return ok(SENT);
};
