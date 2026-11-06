const id = (value: number) => value.toLocaleString('id-ID');

/** 130000 → "130K" (format pricelist brand). */
export function formatPriceShort(value: number): string {
  return `${id(value / 1000)}K`;
}

/** 130000 → "Rp130.000" (untuk aria-label). */
export function formatRupiah(value: number): string {
  return `Rp${id(value)}`;
}

/** "130K" / "130.000" / "130000" / "Rp130.000" → 130000. Input tak dikenal → null. */
export function parsePriceInput(input: string): number | null {
  const clean = input
    .trim()
    .toLowerCase()
    .replace(/^rp\s*/, '')
    .replace(/\s/g, '');
  if (clean === '') return null;

  const short = clean.match(/^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?k$/);
  if (short) {
    const whole = short[1]!.replace(/\./g, '');
    return Math.round(Number(`${whole}.${short[2] ?? '0'}`) * 1000);
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ''));
  if (/^\d+$/.test(clean)) return Number(clean);
  return null;
}

/** (85000, 130000) → "85K–130K"; min = max atau max kosong → "85K". */
export function formatPriceRange(min: number, max: number | null = null): string {
  if (max === null || max === min) return formatPriceShort(min);
  return `${formatPriceShort(min)}–${formatPriceShort(max)}`;
}

/** ("08:00", "23:00") → "08.00–23.00". */
export function formatHours(open: string, close: string): string {
  return `${open.replace(':', '.')}–${close.replace(':', '.')}`;
}

/** 4.9 → "4,9". */
export function formatRating(rating: number): string {
  return rating.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "2026-11-01" → "1 November 2026". */
export function formatDateId(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
