// Klien Supabase untuk build (dan SSR publik): kunci anon/publishable, tanpa sesi.
// RLS yang membatasi: hanya baris aktif yang terbaca.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | undefined;

export function getBuildClient(): SupabaseClient<Database> {
  client ??= createClient<Database>(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
