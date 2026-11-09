// Klien Supabase per-request dengan sesi dari cookie. Dipakai panel admin (M3).
// Jalan dengan hak pengguna yang login, jadi RLS tetap berlaku.
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Penanda "jangan ingat saya": bernilai "0" membuat cookie sesi Supabase menjadi cookie sesi
 * browser (hilang saat browser ditutup), termasuk saat token diperbarui di request berikutnya.
 */
export const REMEMBER_COOKIE = 'gb-remember';

interface Context {
  request: Request;
  cookies: AstroCookies;
}

export function createServerSupabase(
  context: Context,
  options: { sessionOnly?: boolean } = {},
): SupabaseClient<Database> {
  const sessionOnly = options.sessionOnly ?? context.cookies.get(REMEMBER_COOKIE)?.value === '0';
  return createServerClient<Database>(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('Cookie') ?? '').flatMap((cookie) =>
            cookie.value === undefined ? [] : [{ name: cookie.name, value: cookie.value }],
          );
        },
        setAll(cookiesToSet) {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            const { maxAge, expires, ...rest } = cookieOptions;
            // Cookie yang dihapus (maxAge 0) tetap harus membawa maxAge agar benar-benar hilang.
            const persistent = sessionOnly && maxAge !== 0 ? rest : cookieOptions;
            void expires;
            context.cookies.set(name, value, persistent);
          }
        },
      },
    },
  );
}
