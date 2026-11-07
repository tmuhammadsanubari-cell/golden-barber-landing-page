// Fungsi murni untuk halaman Pengaturan Situs (PRD F-21): teks template, pratinjau, bentuk isian.
import { normalizePhone } from '@/lib/whatsapp';
import type { WhatsAppTemplateKey } from '@/types/content';
import { TEMPLATE_PLACEHOLDERS } from '@/lib/validation/admin-settings';

export interface TemplateMeta {
  key: WhatsAppTemplateKey;
  title: string;
  where: string;
}

/** Judul dan tempat pemakaian tiap template (urutan tampil). */
export const TEMPLATE_META: TemplateMeta[] = [
  { key: 'general', title: 'Booking umum', where: 'Tombol booking di hero, navbar, footer, dan tombol melayang' },
  { key: 'branch', title: 'Booking cabang', where: 'Tombol "Booking WA" di kartu cabang dan halaman cabang' },
  { key: 'barber', title: 'Booking barber', where: 'Tombol "Booking" di tabel pricelist' },
  { key: 'service', title: 'Tanya layanan', where: 'Item di bagian Layanan' },
  { key: 'branch_no_pricelist', title: 'Tanya harga', where: 'Cabang yang pricelist-nya "Segera Hadir"' },
  { key: 'academy', title: 'Minat Golden Academy', where: 'Setelah form Academy terkirim' },
  { key: 'partnership', title: 'Minat kemitraan', where: 'Setelah form Kemitraan terkirim' },
];

/** Data contoh untuk pratinjau. */
export const SAMPLE_VALUES: Record<string, string> = {
  nama_cabang: 'Dipatiukur',
  nama_barber: 'Aditia',
  layanan: 'Haircut Reguler',
  nama_layanan: 'Highlight',
  harga: '130K',
  nama: 'Rizky',
};

/** Isi template dengan data contoh; placeholder tak dikenal dibiarkan apa adanya. */
export function previewTemplate(template: string): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => SAMPLE_VALUES[name] ?? whole);
}

/** Sisipkan `{placeholder}` di posisi kursor (atau ganti pilihan). Mengembalikan teks dan posisi kursor baru. */
export function insertPlaceholder(
  text: string,
  placeholder: string,
  selectionStart: number,
  selectionEnd: number,
): { text: string; cursor: number } {
  const token = `{${placeholder}}`;
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  return { text: text.slice(0, start) + token + text.slice(end), cursor: start + token.length };
}

export const placeholdersFor = (key: WhatsAppTemplateKey) => TEMPLATE_PLACEHOLDERS[key];

/** "6281214807192" → "812-1480-7192" (isian setelah awalan +62). */
export function phoneToField(stored: string): string {
  const national = normalizePhone(stored).replace(/^62/, '');
  return national.replace(/^(\d{3})(\d{4})(\d+)$/, '$1-$2-$3');
}

/** Isian "812-1480-7192" / "0812 1480 7192" / "+62 812…" → nilai simpan "6281214807192". */
export function fieldToPhone(field: string): string {
  const digits = field.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

/** "4,9" / "4.9" → 4.9; tak terbaca → NaN. */
export function parseRating(text: string): number {
  const normalized = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export const ratingToField = (value: number) => String(value).replace('.', ',');

/** "3.340" / "3340" → 3340; tak terbaca → NaN. */
export function parseCount(text: string): number {
  const digits = text.trim().replace(/[.\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** Perbandingan nilai JSON (untuk "ada perubahan?"). */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
