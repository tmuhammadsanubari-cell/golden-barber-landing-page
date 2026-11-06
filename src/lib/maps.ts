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
export function formatAddress(
  branch: Pick<Branch, 'address' | 'district' | 'city' | 'postal_code'>,
): string {
  const city = [branch.city, branch.postal_code].filter(Boolean).join(' ');
  return [branch.address, branch.district, city].filter(Boolean).join(', ');
}
