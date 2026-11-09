/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminProfile } from '@/types/admin';
import type { Database } from '@/types/database';

declare global {
  namespace App {
    interface Locals {
      /** Klien Supabase per-request dengan sesi cookie. Diisi middleware untuk /admin dan /api. */
      supabase: SupabaseClient<Database>;
      /** Admin aktif yang login; null bila tanpa sesi atau bukan admin aktif. */
      admin: AdminProfile | null;
    }
  }
}
