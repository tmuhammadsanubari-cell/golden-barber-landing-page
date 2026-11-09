// Akses data galeri untuk panel admin (PRD F-21). Klien sesi admin (RLS berlaku); `service` hanya
// untuk menghapus berkas di storage.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import {
  checkGallery,
  type GalleryCreate,
  type GalleryPatch,
} from '@/lib/validation/admin-gallery';
import type { Database } from '@/types/database';
import { removeMedia } from './uploads';

type Client = SupabaseClient<Database>;
export type GalleryRow = Database['public']['Tables']['gallery_items']['Row'];

export async function listGallery(supabase: Client): Promise<GalleryRow[]> {
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

async function getRow(supabase: Client, id: string): Promise<GalleryRow | null> {
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Item baru di akhir urutan. */
export async function createGalleryItem(
  supabase: Client,
  input: GalleryCreate,
): Promise<DbResult<GalleryRow>> {
  const last = await supabase
    .from('gallery_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (last.error) throw last.error;
  const sortOrder = (last.data?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('gallery_items')
    .insert({ ...input, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

/** Ubah semua field (PUT). Gambar diganti → berkas lama dihapus dari storage. */
export async function updateGalleryItem(
  supabase: Client,
  service: Client,
  id: string,
  input: GalleryCreate,
): Promise<DbResult<GalleryRow>> {
  const current = await getRow(supabase, id);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  const { data, error } = await supabase
    .from('gallery_items')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  if (current.image_path !== input.image_path) await removeMedia(service, current.image_path);
  return { ok: true, data };
}

/** Ubah sebagian field. Aturan alt text dicek pada data hasil gabungan. */
export async function patchGalleryItem(
  supabase: Client,
  id: string,
  patch: GalleryPatch,
): Promise<DbResult<GalleryRow>> {
  const current = await getRow(supabase, id);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  const merged = { ...current, ...patch };
  const details = checkGallery(merged);
  if (Object.keys(details).length > 0) return { ok: false, code: 'VALIDATION_ERROR', details };

  const { data, error } = await supabase
    .from('gallery_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

/** Hapus item dan berkasnya di storage (PRD F-21). */
export async function deleteGalleryItem(
  supabase: Client,
  service: Client,
  id: string,
): Promise<DbResult<{ id: string }>> {
  const current = await getRow(supabase, id);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  const { error } = await supabase.from('gallery_items').delete().eq('id', id);
  if (error) throw error;
  await removeMedia(service, current.image_path);
  return { ok: true, data: { id } };
}

/** Simpan urutan. Daftar harus memuat semua item galeri. */
export async function reorderGallery(
  supabase: Client,
  items: { id: string; sort_order: number }[],
): Promise<DbResult<{ count: number }>> {
  const all = await supabase.from('gallery_items').select('id');
  if (all.error) throw all.error;
  const known = new Set((all.data ?? []).map((row) => row.id));
  if (items.some((item) => !known.has(item.id))) return { ok: false, code: 'NOT_FOUND' };
  if (known.size !== items.length) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Daftar galeri berubah. Muat ulang halaman lalu atur urutan lagi.',
    };
  }
  const results = await Promise.all(
    items.map((item) =>
      supabase.from('gallery_items').update({ sort_order: item.sort_order }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { ok: true, data: { count: items.length } };
}
