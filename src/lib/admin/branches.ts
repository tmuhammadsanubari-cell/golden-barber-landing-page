// Fungsi murni untuk halaman Cabang admin (PRD F-16): status, filter, nilai awal form.
import { formatPhoneDisplay } from '@/lib/whatsapp';
import type { Database } from '@/types/database';

export type BranchRow = Database['public']['Tables']['branches']['Row'];
export type Region = BranchRow['region'];

export const REGION_LABEL: Record<Region, string> = {
  bandung_raya: 'Bandung Raya',
  jabodetabek: 'Jabodetabek',
};

export type BranchStatus = 'aktif' | 'baru' | 'nonaktif';
export type BranchFilter = BranchStatus;

export const STATUS_LABEL: Record<BranchStatus, string> = {
  aktif: 'Aktif',
  baru: 'Cabang Baru',
  nonaktif: 'Nonaktif',
};

export const STATUS_BADGE: Record<BranchStatus, string> = {
  aktif: 'b-ok',
  baru: 'b-new',
  nonaktif: 'b-off',
};

/** Tiga status saling lepas (jumlah chip = total): nonaktif menang atas baru. */
export function branchStatus(branch: Pick<BranchRow, 'is_active' | 'is_new'>): BranchStatus {
  if (!branch.is_active) return 'nonaktif';
  return branch.is_new ? 'baru' : 'aktif';
}

/** Baris tabel: data cabang + jumlah barber (semua, termasuk nonaktif). */
export interface BranchListItem {
  id: string;
  slug: string;
  name: string;
  region: Region;
  city: string;
  sort_order: number;
  is_flagship: boolean;
  is_active: boolean;
  is_new: boolean;
  barbers: number;
}

export function toListItem(row: BranchRow, barbers: number): BranchListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    region: row.region,
    city: row.city,
    sort_order: row.sort_order,
    is_flagship: row.is_flagship,
    is_active: row.is_active,
    is_new: row.is_new,
    barbers,
  };
}

export function countByStatus(items: Pick<BranchRow, 'is_active' | 'is_new'>[]) {
  const counts: Record<BranchStatus, number> = { aktif: 0, baru: 0, nonaktif: 0 };
  for (const item of items) counts[branchStatus(item)] += 1;
  return counts;
}

export function filterBranches(
  items: BranchListItem[],
  filter: BranchFilter | null,
  q: string | null,
): BranchListItem[] {
  const needle = q?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (filter && branchStatus(item) !== filter) return false;
    if (!needle) return true;
    return [item.name, item.city, REGION_LABEL[item.region], item.slug].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}

/** Postgres `time` → "HH:MM" ("08:00:00" → "08:00"). */
export function hhmm(value: string): string {
  return value.slice(0, 5);
}

/** Nilai form (string untuk input) dari baris DB, atau default untuk cabang baru. */
export interface BranchFormValues {
  name: string;
  slug: string;
  region: Region;
  address: string;
  district: string;
  city: string;
  province: string;
  postal_code: string;
  address_incomplete: boolean;
  maps_url: string;
  maps_embed_url: string;
  latitude: string;
  longitude: string;
  open_time: string;
  close_time: string;
  whatsapp_number: string;
  is_flagship: boolean;
  is_new: boolean;
  is_active: boolean;
  internal_note: string;
}

export const EMPTY_BRANCH: BranchFormValues = {
  name: '',
  slug: '',
  region: 'bandung_raya',
  address: '',
  district: '',
  city: '',
  province: 'Jawa Barat',
  postal_code: '',
  address_incomplete: false,
  maps_url: '',
  maps_embed_url: '',
  latitude: '',
  longitude: '',
  open_time: '08:00',
  close_time: '23:00',
  whatsapp_number: '',
  is_flagship: false,
  is_new: true,
  is_active: true,
  internal_note: '',
};

export function toFormValues(row: BranchRow): BranchFormValues {
  return {
    name: row.name,
    slug: row.slug,
    region: row.region,
    address: row.address,
    district: row.district ?? '',
    city: row.city,
    province: row.province,
    postal_code: row.postal_code ?? '',
    address_incomplete: row.address_incomplete,
    maps_url: row.maps_url ?? '',
    maps_embed_url: row.maps_embed_url ?? '',
    latitude: row.latitude === null ? '' : String(row.latitude),
    longitude: row.longitude === null ? '' : String(row.longitude),
    open_time: hhmm(row.open_time),
    close_time: hhmm(row.close_time),
    whatsapp_number: row.whatsapp_number ? formatPhoneDisplay(row.whatsapp_number) : '',
    is_flagship: row.is_flagship,
    is_new: row.is_new,
    is_active: row.is_active,
    internal_note: row.internal_note ?? '',
  };
}

/** Ubah urutan: pindahkan item `from` ke posisi `to` (untuk naik/turun & seret). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
