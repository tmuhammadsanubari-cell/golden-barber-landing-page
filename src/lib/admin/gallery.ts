// Fungsi murni untuk halaman Galeri admin (PRD F-21). Tanpa akses jaringan/DB.
import type { GalleryRow } from './gallery-db';

export type GalleryItem = Pick<
  GalleryRow,
  | 'id'
  | 'title'
  | 'description'
  | 'image_path'
  | 'alt_text'
  | 'is_placeholder'
  | 'is_active'
  | 'sort_order'
>;

/** "low-fade_pompadour.webp" → "Low fade pompadour". Dipakai sebagai judul awal item baru. */
export function titleFromFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (base.length < 2) return 'Gaya baru';
  const title = base.charAt(0).toUpperCase() + base.slice(1);
  return title.length > 80 ? title.slice(0, 80).trim() : title;
}

/** "8 gambar · 7 aktif" (teks bawah judul halaman). */
export function gallerySummary(items: Pick<GalleryItem, 'is_active'>[]): string {
  const active = items.filter((item) => item.is_active).length;
  if (items.length === 0) return 'Belum ada gambar.';
  return `${items.length} gambar · ${active} aktif`;
}

/** Item aktif yang tampil di situs hanya GALLERY_LIMIT teratas (lihat data/common). */
export function hiddenByLimit(items: Pick<GalleryItem, 'is_active'>[], limit: number): number {
  return Math.max(0, items.filter((item) => item.is_active).length - limit);
}
