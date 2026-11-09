// Media di bucket Supabase `media` (PRD 4.2, F-21). Aman dipakai client dan server: tidak membaca
// rahasia. DB menyimpan path bucket (`gallery/{uuid}.webp`); data lama/dummy menyimpan path
// situs (`/images/dummy/galeri-1.webp`). `mediaUrl` mengubah keduanya jadi URL yang bisa dimuat.

export const MEDIA_BUCKET = 'media';

/** Batas ukuran unggahan: 3 MB (PRD F-21). Sama dengan `file_size_limit` bucket. */
export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

export const UPLOAD_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;

/** Folder yang boleh dipakai unggahan. */
export const UPLOAD_FOLDERS = ['gallery', 'branches', 'site'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** `gallery/6f1c…-….webp`: berkas di bucket (bukan aset situs). */
const STORAGE_PATH = /^(?:gallery|branches|site)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export function isStoragePath(path: string): boolean {
  return STORAGE_PATH.test(path);
}

/** Path aset situs yang dikirim bersama kode, mis. foto dummy. */
export function isSitePath(path: string): boolean {
  return /^\/images\/[\w./-]+$/.test(path) && !path.includes('..');
}

export function isUploadType(type: string): type is UploadType {
  return Object.hasOwn(UPLOAD_TYPES, type);
}

export function mediaPublicUrl(path: string, supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/**
 * Path dari DB → `src` untuk gambar. Path bucket diubah jadi URL publik Supabase; path situs
 * (`/images/...`) dan URL penuh dibiarkan.
 */
export function mediaUrl(
  path: string,
  supabaseUrl: string | undefined = import.meta.env?.PUBLIC_SUPABASE_URL,
): string {
  if (!isStoragePath(path) || !supabaseUrl) return path;
  return mediaPublicUrl(path, supabaseUrl);
}

/** "1,8 MB" / "320 KB" untuk antrean unggah. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Pesan galat untuk berkas yang ditolak sebelum dikirim; `null` = lolos. */
export function checkUploadFile(file: { name: string; type: string; size: number }): string | null {
  if (!isUploadType(file.type)) return 'Format file harus JPG, PNG, atau WebP.';
  if (file.size > UPLOAD_MAX_BYTES) {
    return `File terlalu besar (${formatBytes(file.size)}). Maksimal 3 MB — kompres atau simpan sebagai WebP.`;
  }
  if (file.size === 0) return 'File kosong.';
  return null;
}
