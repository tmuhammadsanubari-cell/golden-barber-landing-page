// Akses data cabang untuk panel admin (PRD F-16). Memakai klien sesi admin: RLS berlaku.
// Hasil berupa union `ok`, supaya endpoint tinggal memetakan ke envelope error PRD 4.5.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { DbResult } from '@/lib/api/db-result';
import type { BranchInput } from '@/lib/validation/admin-branches';
import { toListItem, type BranchListItem, type BranchRow } from './branches';

type Client = SupabaseClient<Database>;

export const SLUG_TAKEN = 'Slug sudah dipakai cabang lain';
const HAS_BARBERS =
  'Cabang masih memiliki barber. Nonaktifkan cabang ini, atau pindahkan barbernya ke cabang lain dulu.';

interface PgError {
  code?: string;
  message?: string;
}

const isPgError = (error: unknown): error is PgError => typeof error === 'object' && error !== null;

/** Semua cabang (termasuk nonaktif) urut tampil, plus jumlah barber. */
export async function listBranchItems(supabase: Client): Promise<BranchListItem[]> {
  const [branches, barbers] = await Promise.all([
    supabase.from('branches').select('*').order('sort_order').order('name'),
    supabase.from('barbers').select('branch_id').limit(10_000),
  ]);
  if (branches.error) throw branches.error;
  if (barbers.error) throw barbers.error;

  const perBranch = new Map<string, number>();
  for (const row of barbers.data ?? []) {
    perBranch.set(row.branch_id, (perBranch.get(row.branch_id) ?? 0) + 1);
  }
  return (branches.data ?? []).map((row) => toListItem(row, perBranch.get(row.id) ?? 0));
}

export async function getBranchRow(supabase: Client, id: string): Promise<BranchRow | null> {
  const { data, error } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function slugTakenBy(supabase: Client, slug: string, exceptId?: string): Promise<boolean> {
  let query = supabase.from('branches').select('id').eq('slug', slug);
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

const slugConflict = (): DbResult<never> => ({
  ok: false,
  code: 'CONFLICT',
  message: SLUG_TAKEN,
  details: { slug: SLUG_TAKEN },
});

/** Hanya satu cabang pusat: turunkan yang lama. Mengembalikan id yang diturunkan (untuk pulihkan). */
async function demoteFlagship(supabase: Client, exceptId?: string): Promise<string[]> {
  let query = supabase.from('branches').select('id').eq('is_flagship', true);
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query;
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.id);
  if (ids.length === 0) return [];
  const update = await supabase.from('branches').update({ is_flagship: false }).in('id', ids);
  if (update.error) throw update.error;
  return ids;
}

async function restoreFlagship(supabase: Client, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase.from('branches').update({ is_flagship: true }).in('id', ids);
}

function mapWriteError(error: unknown): DbResult<never> | null {
  if (isPgError(error) && error.code === '23505') {
    if (error.message?.includes('slug')) return slugConflict();
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Sudah ada cabang pusat lain. Muat ulang halaman lalu coba lagi.',
    };
  }
  return null;
}

export async function createBranch(
  supabase: Client,
  input: BranchInput,
): Promise<DbResult<BranchRow>> {
  if (await slugTakenBy(supabase, input.slug)) return slugConflict();

  const last = await supabase
    .from('branches')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (last.error) throw last.error;
  const sortOrder = (last.data?.[0]?.sort_order ?? 0) + 1;

  const demoted = input.is_flagship ? await demoteFlagship(supabase) : [];
  const { data, error } = await supabase
    .from('branches')
    .insert({ ...input, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) {
    await restoreFlagship(supabase, demoted);
    const mapped = mapWriteError(error);
    if (mapped) return mapped;
    throw error;
  }
  return { ok: true, data };
}

export async function updateBranch(
  supabase: Client,
  id: string,
  input: BranchInput,
): Promise<DbResult<BranchRow>> {
  const existing = await getBranchRow(supabase, id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };
  if (await slugTakenBy(supabase, input.slug, id)) return slugConflict();

  const demoted =
    input.is_flagship && !existing.is_flagship ? await demoteFlagship(supabase, id) : [];
  const { data, error } = await supabase
    .from('branches')
    .update(input)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error || !data) {
    await restoreFlagship(supabase, demoted);
    if (error) {
      const mapped = mapWriteError(error);
      if (mapped) return mapped;
      throw error;
    }
    return { ok: false, code: 'NOT_FOUND' };
  }
  return { ok: true, data };
}

/** Ubah satu kolom boolean (aktifkan/nonaktifkan dari menu baris) tanpa mengirim seluruh form. */
export async function setBranchActive(
  supabase: Client,
  id: string,
  isActive: boolean,
): Promise<DbResult<BranchRow>> {
  const { data, error } = await supabase
    .from('branches')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

export async function deleteBranch(
  supabase: Client,
  id: string,
): Promise<DbResult<{ id: string }>> {
  const existing = await getBranchRow(supabase, id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };

  const barbers = await supabase
    .from('barbers')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', id);
  if (barbers.error) throw barbers.error;
  if ((barbers.count ?? 0) > 0) return { ok: false, code: 'CONFLICT', message: HAS_BARBERS };

  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) {
    // FK barbers → branches (on delete restrict) sebagai pengaman bila ada barber baru masuk.
    if (isPgError(error) && error.code === '23503') {
      return { ok: false, code: 'CONFLICT', message: HAS_BARBERS };
    }
    throw error;
  }
  return { ok: true, data: { id } };
}

/** Simpan urutan. Daftar harus memuat semua cabang, supaya urutan tidak setengah jadi. */
export async function reorderBranches(
  supabase: Client,
  items: { id: string; sort_order: number }[],
): Promise<DbResult<{ count: number }>> {
  const all = await supabase.from('branches').select('id');
  if (all.error) throw all.error;
  const known = new Set((all.data ?? []).map((row) => row.id));
  const sameSet = items.length === known.size && items.every((item) => known.has(item.id));
  if (!sameSet) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Daftar cabang berubah. Muat ulang halaman lalu atur urutan lagi.',
    };
  }

  const results = await Promise.all(
    items.map((item) =>
      supabase.from('branches').update({ sort_order: item.sort_order }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { ok: true, data: { count: items.length } };
}
