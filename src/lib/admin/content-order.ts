// Simpan urutan daftar konten (testimoni, FAQ). Daftar harus memuat SEMUA baris tabel itu.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export async function reorderRows(
  supabase: Client,
  table: 'testimonials' | 'faqs',
  items: { id: string; sort_order: number }[],
  noun: string,
): Promise<DbResult<{ count: number }>> {
  const all = await supabase.from(table).select('id');
  if (all.error) throw all.error;
  const known = new Set((all.data ?? []).map((row) => row.id));
  if (items.some((item) => !known.has(item.id))) return { ok: false, code: 'NOT_FOUND' };
  if (known.size !== items.length) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `Daftar ${noun} berubah. Muat ulang halaman lalu atur urutan lagi.`,
    };
  }
  const results = await Promise.all(
    items.map((item) =>
      supabase.from(table).update({ sort_order: item.sort_order }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { ok: true, data: { count: items.length } };
}
