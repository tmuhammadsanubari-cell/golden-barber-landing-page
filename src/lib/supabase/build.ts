// Klien Supabase untuk build (dan SSR publik): kunci anon/publishable, tanpa sesi.
// RLS yang membatasi: hanya baris aktif yang terbaca.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

let client: SupabaseClient | undefined;

export function getBuildClient(): SupabaseClient {
  client ??= createClient(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
