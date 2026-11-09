// Akses data layanan & ketersediaan untuk panel admin (PRD F-18). Klien sesi admin: RLS berlaku.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { DbResult } from '@/lib/api/db-result';
import { slugify } from '@/lib/slug';
import {
  checkServicePrice,
  normalizeServicePrice,
  type AvailabilityItem,
  type ServiceCreate,
  type ServicePatch,
} from '@/lib/validation/admin-services';
import type { BranchServiceRow, ServiceRow, Status } from './services';

type Client = SupabaseClient<Database>;

export async function listServices(supabase: Client): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('category')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getServiceRow(supabase: Client, id: string): Promise<ServiceRow | null> {
  const { data, error } = await supabase.from('services').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Slug unik dari nama: "Hair Spa" → "hair-spa", bentrok → "hair-spa-2". */
async function uniqueSlug(supabase: Client, name: string): Promise<string> {
  const base = slugify(name) || 'layanan';
  const { data, error } = await supabase.from('services').select('slug').like('slug', `${base}%`);
  if (error) throw error;
  const taken = new Set((data ?? []).map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

async function nextSortOrder(supabase: Client, category: ServiceRow['category']): Promise<number> {
  const { data, error } = await supabase
    .from('services')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.sort_order ?? 0) + 1;
}

/** Layanan baru: trigger database mengisi `branch_services` semua cabang dengan 'unavailable'. */
export async function createService(
  supabase: Client,
  input: ServiceCreate,
): Promise<DbResult<ServiceRow>> {
  const { data, error } = await supabase
    .from('services')
    .insert({
      ...input,
      slug: await uniqueSlug(supabase, input.name),
      sort_order: await nextSortOrder(supabase, input.category),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

/** Ubah sebagian field; aturan Rentang dicek pada data gabungan, harga maks dikosongkan untuk tipe lain. */
export async function patchService(
  supabase: Client,
  id: string,
  patch: ServicePatch,
): Promise<DbResult<ServiceRow>> {
  const existing = await getServiceRow(supabase, id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };

  const merged = normalizeServicePrice({
    price_type: patch.price_type ?? existing.price_type,
    price_min: patch.price_min ?? existing.price_min,
    price_max: patch.price_max !== undefined ? patch.price_max : existing.price_max,
  });
  const errors = checkServicePrice(merged);
  if (Object.keys(errors).length > 0)
    return { ok: false, code: 'VALIDATION_ERROR', details: errors };

  // Pindah kategori: taruh di akhir kategori tujuan.
  const move =
    patch.category !== undefined && patch.category !== existing.category
      ? { sort_order: await nextSortOrder(supabase, patch.category) }
      : {};
  const { data, error } = await supabase
    .from('services')
    .update({ ...patch, price_max: merged.price_max, ...move })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

/** PUT penuh (form Edit): semua field, slug tidak berubah supaya tautan/identitas tetap. */
export async function updateService(
  supabase: Client,
  id: string,
  input: ServiceCreate,
): Promise<DbResult<ServiceRow>> {
  return patchService(supabase, id, input);
}

export async function deleteService(
  supabase: Client,
  id: string,
): Promise<DbResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data: { id: data.id } } : { ok: false, code: 'NOT_FOUND' };
}

/** Simpan urutan satu kategori. Daftar harus memuat semua layanan kategori itu. */
export async function reorderServices(
  supabase: Client,
  items: { id: string; sort_order: number }[],
): Promise<DbResult<{ count: number }>> {
  const found = await supabase
    .from('services')
    .select('id, category')
    .in(
      'id',
      items.map((item) => item.id),
    );
  if (found.error) throw found.error;
  const rows = found.data ?? [];
  if (rows.length !== items.length) return { ok: false, code: 'NOT_FOUND' };

  const categories = new Set(rows.map((row) => row.category));
  if (categories.size !== 1) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      details: { _: 'Urutan hanya bisa disimpan untuk satu kategori sekaligus.' },
    };
  }
  const [category] = [...categories];
  const all = await supabase.from('services').select('id').eq('category', category!);
  if (all.error) throw all.error;
  if ((all.data ?? []).length !== items.length) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Daftar layanan berubah. Muat ulang halaman lalu atur urutan lagi.',
    };
  }
  const results = await Promise.all(
    items.map((item) =>
      supabase.from('services').update({ sort_order: item.sort_order }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { ok: true, data: { count: items.length } };
}

// ---------------------------------------------------------------------------------------------
// Ketersediaan per cabang
// ---------------------------------------------------------------------------------------------

export async function listAvailability(supabase: Client): Promise<BranchServiceRow[]> {
  const { data, error } = await supabase.from('branch_services').select('*').limit(5000);
  if (error) throw error;
  return data ?? [];
}

export async function listBranchAvailability(
  supabase: Client,
  branchId: string,
): Promise<BranchServiceRow[]> {
  const { data, error } = await supabase
    .from('branch_services')
    .select('*')
    .eq('branch_id', branchId);
  if (error) throw error;
  return data ?? [];
}

/** Bulk upsert ketersediaan satu cabang. Harga khusus yang tidak dikirim dikosongkan. */
export async function upsertBranchServices(
  supabase: Client,
  branchId: string,
  items: AvailabilityItem[],
): Promise<DbResult<BranchServiceRow[]>> {
  const branch = await supabase.from('branches').select('id').eq('id', branchId).maybeSingle();
  if (branch.error) throw branch.error;
  if (!branch.data) return { ok: false, code: 'NOT_FOUND' };

  const known = await supabase
    .from('services')
    .select('id')
    .in(
      'id',
      items.map((item) => item.service_id),
    );
  if (known.error) throw known.error;
  const knownIds = new Set((known.data ?? []).map((row) => row.id));
  const unknown = items.find((item) => !knownIds.has(item.service_id));
  if (unknown) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      details: { service_id: 'Layanan tidak ditemukan.' },
    };
  }

  const { data, error } = await supabase
    .from('branch_services')
    .upsert(
      items.map((item) => ({ ...item, branch_id: branchId })),
      { onConflict: 'branch_id,service_id' },
    )
    .select('*');
  if (error) throw error;
  return { ok: true, data: data ?? [] };
}

/** "Terapkan ke semua cabang": samakan status satu layanan di semua cabang (harga khusus tetap). */
export async function applyStatusToAll(
  supabase: Client,
  serviceId: string,
  status: Status,
): Promise<DbResult<{ count: number }>> {
  const service = await getServiceRow(supabase, serviceId);
  if (!service) return { ok: false, code: 'NOT_FOUND' };
  const { data, error } = await supabase
    .from('branch_services')
    .update({ status })
    .eq('service_id', serviceId)
    .select('branch_id');
  if (error) throw error;
  return { ok: true, data: { count: (data ?? []).length } };
}
