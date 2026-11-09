// Unggahan gambar ke bucket `media` lewat URL bertanda tangan (PRD F-21, 4.3). Service key tetap
// di server; browser hanya menerima URL sekali pakai untuk SATU path.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import {
  MEDIA_BUCKET,
  UPLOAD_FOLDERS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  isStoragePath,
  isUploadType,
  mediaPublicUrl,
} from '@/lib/media';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export interface SignedUpload {
  /** URL tujuan PUT (berisi token). */
  upload_url: string;
  /** Path di bucket; simpan ke kolom `image_path`/`photo_path` setelah unggah sukses. */
  path: string;
  /** URL publik berkas setelah terunggah (untuk pratinjau). */
  public_url: string;
  max_bytes: number;
}

type Raw = { folder?: unknown; content_type?: unknown; size?: unknown };

/**
 * Validasi permintaan lalu buat URL unggah. Urutan galat mengikuti PRD 4.5:
 * tipe salah → 415, terlalu besar → 413, folder/ukuran rusak → VALIDATION_ERROR.
 */
export async function requestSignedUpload(
  service: Client,
  supabaseUrl: string,
  raw: Raw,
  newId: () => string = () => crypto.randomUUID(),
): Promise<DbResult<SignedUpload>> {
  const { folder, content_type: contentType, size } = raw;
  if (typeof folder !== 'string' || !(UPLOAD_FOLDERS as readonly string[]).includes(folder)) {
    return { ok: false, code: 'VALIDATION_ERROR', details: { folder: 'Folder tidak dikenal.' } };
  }
  if (typeof contentType !== 'string' || !isUploadType(contentType)) {
    return { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' };
  }
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) {
    return { ok: false, code: 'VALIDATION_ERROR', details: { size: 'Ukuran file tidak valid.' } };
  }
  if (size > UPLOAD_MAX_BYTES) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };

  const path = `${folder}/${newId()}.${UPLOAD_TYPES[contentType]}`;
  const { data, error } = await service.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return {
    ok: true,
    data: {
      upload_url: data.signedUrl,
      path,
      public_url: mediaPublicUrl(path, supabaseUrl),
      max_bytes: UPLOAD_MAX_BYTES,
    },
  };
}

/** Hapus berkas dari bucket bila `path` berkas bucket (aset situs/dummy tidak disentuh). */
export async function removeMedia(service: Client, path: string | null | undefined): Promise<void> {
  if (!path || !isStoragePath(path)) return;
  const { error } = await service.storage.from(MEDIA_BUCKET).remove([path]);
  // Baris DB sudah berubah; berkas yatim tidak boleh menggagalkan aksi admin.
  if (error) console.error('[media] gagal menghapus berkas', path, error.message);
}
