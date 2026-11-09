// Fungsi murni untuk halaman Testimoni dan FAQ admin (PRD F-21).
import { isPendingAnswer } from '@/lib/validation/admin-faqs';

/** Rating 1–5 → "★★★★☆". */
export function stars(rating: number): string {
  const full = Math.min(5, Math.max(0, Math.round(rating)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/** Potong teks panjang jadi satu baris pratinjau dengan "…". */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** "3 testimoni · 2 aktif" / "8 FAQ · 6 aktif". */
export function countSummary(noun: string, items: { is_active: boolean }[]): string {
  if (items.length === 0) return `Belum ada ${noun}.`;
  const active = items.filter((item) => item.is_active).length;
  return `${items.length} ${noun} · ${active} aktif`;
}

/** Item aktif di atas batas tampil di situs tidak muncul (PRD F-11: 10 testimoni). */
export function overLimit(items: { is_active: boolean }[], limit: number): number {
  return Math.max(0, items.filter((item) => item.is_active).length - limit);
}

/** FAQ yang jawabannya belum final (tidak boleh ditampilkan). */
export function pendingFaqCount(items: { answer: string }[]): number {
  return items.filter((item) => isPendingAnswer(item.answer)).length;
}
