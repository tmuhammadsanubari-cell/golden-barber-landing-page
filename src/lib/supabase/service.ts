// Klien service role: MELEWATI RLS. Hanya untuk kode server (rute /api, /admin).
// Jangan pernah import file ini dari komponen client atau island React.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | undefined;

export function getServiceClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error('getServiceClient hanya boleh dipanggil di server.');
  }
  client ??= createClient<Database>(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
