// Fungsi murni untuk halaman Barber & Harga admin (PRD F-17).
import { formatPriceShort, formatRupiah, parsePriceInput } from '@/lib/format';
import type { Database } from '@/types/database';

export type BarberRow = Database['public']['Tables']['barbers']['Row'];

/** Kolom harga yang bisa diedit inline, urut seperti kolom tabel. */
export const PRICE_FIELDS = [
  { key: 'haircut_price', label: 'Haircut Reguler', required: true, strike: false },
  { key: 'haircut_original_price', label: 'Harga Coret', required: false, strike: true },
  { key: 'long_trim_price', label: 'Long Trim', required: false, strike: false },
  { key: 'long_trim_original_price', label: 'Harga Coret LT', required: false, strike: true },
] as const;

export type PriceKey = (typeof PRICE_FIELDS)[number]['key'];

/**
 * Teks isian sel harga → rupiah penuh. Selain format `parsePriceInput` ("130K", "130.000",
 * "130000"), angka polos 1–3 digit dibaca sebagai ribuan ("130" → 130000), seperti mockup
 * yang menampilkan sufiks "K". Kosong → null. Tidak dikenal → undefined.
 */
export function parsePriceCell(text: string): number | null | undefined {
  const clean = text.trim();
  if (clean === '') return null;
  if (/^\d{1,3}$/.test(clean)) return Number(clean) * 1000;
  return parsePriceInput(clean) ?? undefined;
}

/**
 * 130000 → "130" (isi kolom edit, sufiks K di sampingnya); 125500 → "125500".
 * Ribuan hanya sampai 999K: angka polos ≥ 4 digit dibaca sebagai rupiah penuh oleh
 * `parsePriceCell`, jadi 1.000.000 harus tetap "1000000" supaya terbaca balik sama.
 */
export function priceEditText(value: number | null): string {
  if (value === null) return '';
  return value % 1000 === 0 && value < 1_000_000 ? String(value / 1000) : String(value);
}

/** Teks tampil sel: "130K", atau "—" bila kosong. */
export function priceText(value: number | null): string {
  return value === null ? '—' : formatPriceShort(value);
}

export function priceAria(label: string, name: string, value: number | null): string {
  return `${label} ${name}: ${value === null ? 'kosong' : formatRupiah(value)}`;
}

/** "15 baris · 14 barber + 1 By Barber". */
export function summaryText(items: Pick<BarberRow, 'is_generic'>[]): string {
  const generic = items.filter((item) => item.is_generic).length;
  const rows = `${items.length} baris`;
  if (items.length === 0) return rows;
  return generic > 0
    ? `${rows} · ${items.length - generic} barber + ${generic} By Barber`
    : `${rows} · ${items.length} barber`;
}

export function filterBarbers<T extends Pick<BarberRow, 'name' | 'label'>>(
  items: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    [item.name, item.label ?? ''].some((field) => field.toLowerCase().includes(needle)),
  );
}

/** Ringkas harga untuk pilihan "Salin harga dari": "130K · LT 150K". */
export function priceSummary(item: Pick<BarberRow, 'haircut_price' | 'long_trim_price'>): string {
  const base = formatPriceShort(item.haircut_price);
  return item.long_trim_price === null
    ? base
    : `${base} · LT ${formatPriceShort(item.long_trim_price)}`;
}

/** Data barber yang dikirim ke island (tanpa kolom waktu). */
export type BarberItem = Omit<BarberRow, 'created_at' | 'updated_at'>;

export interface BranchOption {
  id: string;
  slug: string;
  name: string;
  is_flagship: boolean;
  barbers: number;
}

export function branchOptionLabel(branch: BranchOption): string {
  return `${branch.name}${branch.is_flagship ? ' (Pusat)' : ''} · ${branch.barbers} barber`;
}
