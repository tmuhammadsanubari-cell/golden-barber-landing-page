// Akses data barber untuk panel admin (PRD F-17). Klien sesi admin: RLS berlaku.
// Hasil berupa union `ok` agar endpoint tinggal memetakannya ke envelope error PRD 4.5.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { DbResult } from '@/lib/api/db-result';
import { checkPrices, type BarberCreate, type BarberPatch } from '@/lib/validation/admin-barbers';
import type { BarberRow } from './barbers';

type Client = SupabaseClient<Database>;

interface PgError {
  code?: string;
}
const pgCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null ? (error as PgError).code : undefined;

const BRANCH_MISSING = 'Cabang tidak ditemukan.';

export async function listBarbers(supabase: Client, branchId: string): Promise<BarberRow[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .eq('branch_id', branchId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getBarberRow(supabase: Client, id: string): Promise<BarberRow | null> {
  const { data, error } = await supabase.from('barbers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function branchExists(supabase: Client, id: string): Promise<boolean> {
  const { data, error } = await supabase.from('branches').select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function nextSortOrder(supabase: Client, branchId: string): Promise<number> {
  const { data, error } = await supabase
    .from('barbers')
    .select('sort_order')
    .eq('branch_id', branchId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.sort_order ?? 0) + 1;
}

export async function createBarber(
  supabase: Client,
  input: BarberCreate,
): Promise<DbResult<BarberRow>> {
  if (!(await branchExists(supabase, input.branch_id))) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      details: { branch_id: BRANCH_MISSING },
    };
  }
  const { data, error } = await supabase
    .from('barbers')
    .insert({ ...input, sort_order: await nextSortOrder(supabase, input.branch_id) })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

/**
 * Ubah sebagian field. Aturan lintas-kolom (harga coret > harga aktual) dicek pada data hasil
 * gabungan, jadi mengubah harga aktual di bawah harga coret yang ada ditolak dengan pesan jelas.
 */
export async function patchBarber(
  supabase: Client,
  id: string,
  patch: BarberPatch,
): Promise<DbResult<BarberRow>> {
  const existing = await getBarberRow(supabase, id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };

  const merged = {
    haircut_price: patch.haircut_price ?? existing.haircut_price,
    haircut_original_price:
      patch.haircut_original_price !== undefined
        ? patch.haircut_original_price
        : existing.haircut_original_price,
    long_trim_price:
      patch.long_trim_price !== undefined ? patch.long_trim_price : existing.long_trim_price,
    long_trim_original_price:
      patch.long_trim_original_price !== undefined
        ? patch.long_trim_original_price
        : existing.long_trim_original_price,
  };
  const errors = checkPrices(merged);
  if (Object.keys(errors).length > 0) {
    // Tampilkan di kolom yang sedang diedit bila ada, agar pesan muncul di sel yang benar.
    const edited = Object.keys(patch).find((key) => key in errors);
    const details = edited ? { [edited]: errors[edited]! } : errors;
    return { ok: false, code: 'VALIDATION_ERROR', details };
  }

  const { data, error } = await supabase
    .from('barbers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (pgCode(error) === '23514') {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        details: { _: 'Data tidak memenuhi aturan harga.' },
      };
    }
    throw error;
  }
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

export async function deleteBarber(
  supabase: Client,
  id: string,
): Promise<DbResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('barbers')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data: { id: data.id } } : { ok: false, code: 'NOT_FOUND' };
}

/** Pindah ke cabang lain: ditaruh di akhir urutan cabang tujuan. */
export async function moveBarber(
  supabase: Client,
  id: string,
  branchId: string,
): Promise<DbResult<BarberRow>> {
  const existing = await getBarberRow(supabase, id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };
  if (existing.branch_id === branchId) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      details: { branch_id: 'Barber sudah ada di cabang ini.' },
    };
  }
  if (!(await branchExists(supabase, branchId))) {
    return { ok: false, code: 'VALIDATION_ERROR', details: { branch_id: BRANCH_MISSING } };
  }
  const { data, error } = await supabase
    .from('barbers')
    .update({ branch_id: branchId, sort_order: await nextSortOrder(supabase, branchId) })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

/** Simpan urutan satu cabang. Daftar harus memuat semua barber cabang itu, tidak lebih. */
export async function reorderBarbers(
  supabase: Client,
  items: { id: string; sort_order: number }[],
): Promise<DbResult<{ count: number }>> {
  const found = await supabase
    .from('barbers')
    .select('id, branch_id')
    .in(
      'id',
      items.map((item) => item.id),
    );
  if (found.error) throw found.error;
  const rows = found.data ?? [];
  if (rows.length !== items.length) return { ok: false, code: 'NOT_FOUND' };

  const branchIds = new Set(rows.map((row) => row.branch_id));
  if (branchIds.size !== 1) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      details: { _: 'Urutan hanya bisa disimpan untuk satu cabang sekaligus.' },
    };
  }
  const [branchId] = [...branchIds];

  const all = await supabase.from('barbers').select('id').eq('branch_id', branchId!);
  if (all.error) throw all.error;
  if ((all.data ?? []).length !== items.length) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Daftar barber berubah. Muat ulang halaman lalu atur urutan lagi.',
    };
  }

  const results = await Promise.all(
    items.map((item) =>
      supabase.from('barbers').update({ sort_order: item.sort_order }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { ok: true, data: { count: items.length } };
}
