import type { Branch } from '@/types/content';

/** `maps_url` cabang; kalau kosong dibuat dari nama + alamat (PRD F-02). */
export function buildMapsUrl(
  branch: Pick<Branch, 'name' | 'address' | 'city' | 'maps_url'>,
): string {
  if (branch.maps_url) return branch.maps_url;
  const query = `Golden Barber ${branch.name} ${branch.address} ${branch.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Alamat satu baris untuk kartu cabang. */
export function formatAddress(branch: Pick<Branch, 'address' | 'district' | 'city'>): string {
  return [branch.address, branch.district, branch.city].filter(Boolean).join(', ');
}
