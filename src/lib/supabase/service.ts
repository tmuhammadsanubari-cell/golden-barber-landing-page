// Klien service role: MELEWATI RLS. Hanya untuk kode server (rute /api, /admin).
// Jangan pernah import file ini dari komponen client atau island React.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

let client: SupabaseClient | undefined;

export function getServiceClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getServiceClient hanya boleh dipanggil di server.');
  }
  client ??= createClient(
    requireEnv('PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
