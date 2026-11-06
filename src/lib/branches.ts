import { formatPriceRange } from '@/lib/format';
import type { Barber, Region } from '@/types/content';

export const REGION_LABELS: Record<Region, string> = {
  bandung_raya: 'Bandung Raya',
  jabodetabek: 'Jabodetabek',
};

/** "85K–130K" dari harga Haircut Reguler; satu harga → "70K"; tanpa barber → null (D-12). */
export function haircutRange(barbers: Pick<Barber, 'haircut_price'>[]): string | null {
  if (barbers.length === 0) return null;
  const prices = barbers.map((barber) => barber.haircut_price);
  return formatPriceRange(Math.min(...prices), Math.max(...prices));
}
