// Klien Supabase per-request dengan sesi dari cookie. Dipakai panel admin (M3).
// Jalan dengan hak pengguna yang login, jadi RLS tetap berlaku.
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { requireEnv } from '@/lib/env';

export function createServerSupabase(context: {
  request: Request;
  cookies: AstroCookies;
}): SupabaseClient {
  return createServerClient(requireEnv('PUBLIC_SUPABASE_URL'), requireEnv('PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get('Cookie') ?? '').flatMap((cookie) =>
          cookie.value === undefined ? [] : [{ name: cookie.name, value: cookie.value }],
        );
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          context.cookies.set(name, value, options);
        }
      },
    },
  });
}
