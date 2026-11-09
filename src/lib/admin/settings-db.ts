// Akses data pengaturan situs untuk panel admin (PRD F-21). Klien sesi admin: RLS berlaku
// (admin boleh SELECT dan UPDATE `site_settings`; `service` hanya untuk menghapus berkas lama).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import { mediaUrl } from '@/lib/media';
import {
  SETTINGS_SCHEMAS,
  isEditableKey,
  type EditableKey,
} from '@/lib/validation/admin-settings';
import type { Database, Json } from '@/types/database';
import { removeMedia } from './uploads';

type Client = SupabaseClient<Database>;

export type SettingsMap = Record<string, unknown>;

/** Semua pengaturan: { key: value }. */
export async function listSettings(supabase: Client): Promise<SettingsMap> {
  const { data, error } = await supabase.from('site_settings').select('key, value');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

/** URL gambar hero untuk pratinjau di admin. */
export const heroPreviewUrl = (path: string) => mediaUrl(path);

/**
 * Simpan satu pengaturan. Nilai divalidasi dengan skema kuncinya; hasil validasi (mis. nomor WA
 * yang dinormalkan) yang disimpan. Mengganti gambar hero menghapus berkas lama di bucket.
 */
export async function putSetting(
  supabase: Client,
  service: Client,
  adminId: string,
  key: string,
  rawValue: unknown,
): Promise<DbResult<{ key: string; value: unknown }>> {
  if (!isEditableKey(key)) return { ok: false, code: 'NOT_FOUND' };
  const parsed = SETTINGS_SCHEMAS[key].safeParse(rawValue);
  if (!parsed.success) {
    const details: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      details[issue.path.map(String).join('.') || '_'] ??= issue.message;
    }
    return { ok: false, code: 'VALIDATION_ERROR', details };
  }

  const current = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return { ok: false, code: 'NOT_FOUND' };

  const { data, error } = await supabase
    .from('site_settings')
    .update({ value: parsed.data as Json, updated_by: adminId })
    .eq('key', key)
    .select('key, value')
    .single();
  if (error) throw error;

  if (key === 'hero') {
    const before = (current.data.value as { image_path?: string } | null)?.image_path;
    const after = (parsed.data as { image_path: string }).image_path;
    if (before && before !== after) await removeMedia(service, before);
  }
  return { ok: true, data: { key: data.key, value: data.value } };
}

export type { EditableKey };
