// Fungsi murni untuk halaman Layanan admin (PRD F-18).
import { formatPriceRange, formatPriceShort } from '@/lib/format';
import type { Database } from '@/types/database';

export type ServiceRow = Database['public']['Tables']['services']['Row'];
export type BranchServiceRow = Database['public']['Tables']['branch_services']['Row'];
export type Category = ServiceRow['category'];
export type PriceType = ServiceRow['price_type'];
export type Status = BranchServiceRow['status'];

export const CATEGORY_ORDER: Category[] = ['add_on', 'hair_colouring', 'hair_treatment'];

export const CATEGORY_LABEL: Record<Category, string> = {
  add_on: 'Add-ons',
  hair_colouring: 'Hair Colouring',
  hair_treatment: 'Hair Treatment',
};

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  fixed: 'Tetap',
  start_from: 'Mulai dari',
  range: 'Rentang',
};

export const STATUS_LABEL: Record<Status, string> = {
  available: 'Tersedia',
  soon: 'Segera Hadir',
  unavailable: 'Tidak Tersedia',
};

/** Kelas gaya sel matriks (`.av.ok` / `.soon` / `.no`). */
export const STATUS_CLASS: Record<Status, string> = {
  available: 'ok',
  soon: 'soon',
  unavailable: 'no',
};

/** Data layanan yang dikirim ke island (tanpa kolom waktu). */
export type ServiceItem = Omit<ServiceRow, 'created_at' | 'updated_at'>;

/** Tetap "20K", Mulai dari "Mulai 350K", Rentang "150K–300K". */
export function servicePriceText(
  service: Pick<ServiceRow, 'price_type' | 'price_min' | 'price_max'>,
): string {
  if (service.price_type === 'start_from') return `Mulai ${formatPriceShort(service.price_min)}`;
  if (service.price_type === 'range') return formatPriceRange(service.price_min, service.price_max);
  return formatPriceShort(service.price_min);
}

/** Harga khusus cabang: "85K" atau "85K–100K". */
export function overrideText(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  return formatPriceRange(min, max);
}

export interface ServiceGroup<T> {
  category: Category;
  title: string;
  items: T[];
}

/** Kelompokkan per kategori (urutan tetap), item urut `sort_order`. Kategori kosong dibuang. */
export function groupByCategory<T extends { category: Category; sort_order: number; name: string }>(
  items: T[],
): ServiceGroup<T>[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    title: CATEGORY_LABEL[category],
    items: items
      .filter((item) => item.category === category)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  })).filter((group) => group.items.length > 0);
}

export interface ServiceFormValues {
  name: string;
  category: Category;
  price_type: PriceType;
  price_min: string;
  price_max: string;
  note: string;
  description: string;
  is_active: boolean;
}

export const EMPTY_SERVICE: ServiceFormValues = {
  name: '',
  category: 'add_on',
  price_type: 'fixed',
  price_min: '',
  price_max: '',
  note: '',
  description: '',
  is_active: true,
};

export function toServiceForm(item: ServiceItem): ServiceFormValues {
  return {
    name: item.name,
    category: item.category,
    price_type: item.price_type,
    price_min: formatPriceShort(item.price_min),
    price_max: item.price_max === null ? '' : formatPriceShort(item.price_max),
    note: item.note ?? '',
    description: item.description ?? '',
    is_active: item.is_active,
  };
}

/** Nilai awal sel matriks tanpa baris (layanan/cabang baru): Tidak Tersedia (PRD F-18). */
export const DEFAULT_STATUS: Status = 'unavailable';

/** Peta "branchId:serviceId" → baris ketersediaan. */
export function availabilityMap(rows: BranchServiceRow[]): Map<string, BranchServiceRow> {
  return new Map(rows.map((row) => [`${row.branch_id}:${row.service_id}`, row]));
}
