// Skema barber & harga untuk panel admin (PRD F-17). Dipakai client dan server.
// Harga disimpan integer rupiah; input menerima "130K", "130.000", atau "130000" (PRD F-17).
import { z } from 'zod';
import { parsePriceInput } from '@/lib/format';

export const PRICE_MIN = 10_000;
export const PRICE_MAX = 10_000_000;

export const PRICE_MESSAGES = {
  invalid: 'Harga tidak valid. Contoh: 130K atau 130.000.',
  min: 'Harga minimal Rp10.000.',
  max: 'Harga maksimal Rp10.000.000.',
  strike: 'Harga coret harus lebih besar dari harga aktual.',
  strikeNeedsPrice: 'Isi harga Long Trim dulu sebelum memasang harga coret.',
};

type PriceInput = string | number | null;
const priceInput = z.union([z.string(), z.number(), z.null()], { error: PRICE_MESSAGES.invalid });

/** Normalisasi satu harga. `undefined` = tidak diubah, `null` = kosong, angka = rupiah penuh. */
function normalizePrice(value: PriceInput, ctx: z.RefinementCtx): number | null {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = typeof value === 'number' ? value : parsePriceInput(value);
  if (parsed === null || !Number.isInteger(parsed)) {
    ctx.addIssue({ code: 'custom', message: PRICE_MESSAGES.invalid });
    return z.NEVER;
  }
  if (parsed < PRICE_MIN) {
    ctx.addIssue({ code: 'custom', message: PRICE_MESSAGES.min });
    return z.NEVER;
  }
  if (parsed > PRICE_MAX) {
    ctx.addIssue({ code: 'custom', message: PRICE_MESSAGES.max });
    return z.NEVER;
  }
  return parsed;
}

/** Harga wajib (Haircut Reguler). */
export const requiredPrice = (label: string) =>
  priceInput.transform((value, ctx): number => {
    const price = normalizePrice(value, ctx);
    if (price === null) {
      ctx.addIssue({ code: 'custom', message: `${label} wajib diisi.` });
      return z.NEVER;
    }
    return price;
  });

/** Harga opsional (Long Trim, harga coret): kosong → null. */
export const optionalPrice = priceInput.transform((value, ctx) => normalizePrice(value, ctx));

const name = z
  .string({ error: 'Nama barber wajib diisi.' })
  .trim()
  .min(1, 'Nama barber wajib diisi.')
  .max(60, 'Nama barber maksimal 60 karakter.');

const label = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string({ error: 'Label harus berupa teks.' })
    .trim()
    .max(40, 'Label maksimal 40 karakter.')
    .nullable(),
);

export interface PriceState {
  haircut_price: number;
  haircut_original_price: number | null;
  long_trim_price: number | null;
  long_trim_original_price: number | null;
}

/** Aturan lintas-kolom: harga coret harus lebih besar dari harga aktual. Kunci = nama kolom. */
export function checkPrices(state: PriceState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (
    state.haircut_original_price !== null &&
    state.haircut_original_price <= state.haircut_price
  ) {
    errors.haircut_original_price = PRICE_MESSAGES.strike;
  }
  if (state.long_trim_original_price !== null) {
    if (state.long_trim_price === null) {
      errors.long_trim_original_price = PRICE_MESSAGES.strikeNeedsPrice;
    } else if (state.long_trim_original_price <= state.long_trim_price) {
      errors.long_trim_original_price = PRICE_MESSAGES.strike;
    }
  }
  return errors;
}

export const barberCreateSchema = z
  .object({
    branch_id: z.uuid({ error: 'Pilih cabang.' }),
    name,
    label: label.optional().transform((value) => value ?? null),
    is_generic: z.boolean({ error: 'Nilai tidak valid.' }).default(false),
    haircut_price: requiredPrice('Harga Haircut Reguler'),
    haircut_original_price: optionalPrice.optional().transform((value) => value ?? null),
    long_trim_price: optionalPrice.optional().transform((value) => value ?? null),
    long_trim_original_price: optionalPrice.optional().transform((value) => value ?? null),
    is_active: z.boolean({ error: 'Nilai tidak valid.' }).default(true),
  })
  .superRefine((value, ctx) => {
    for (const [path, message] of Object.entries(checkPrices(value))) {
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  });

export type BarberCreate = z.output<typeof barberCreateSchema>;

/** PATCH sebagian field (edit inline). Aturan lintas-kolom dicek server pada data hasil gabungan. */
export const barberPatchSchema = z
  .object({
    name: name.optional(),
    label: label.optional(),
    is_generic: z.boolean({ error: 'Nilai tidak valid.' }).optional(),
    haircut_price: requiredPrice('Harga Haircut Reguler').optional(),
    haircut_original_price: optionalPrice.optional(),
    long_trim_price: optionalPrice.optional(),
    long_trim_original_price: optionalPrice.optional(),
    is_active: z.boolean({ error: 'Nilai tidak valid.' }).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Tidak ada perubahan yang dikirim.',
  });

export type BarberPatch = z.output<typeof barberPatchSchema>;

export const moveSchema = z.object({
  branch_id: z.uuid({ error: 'Pilih cabang tujuan.' }),
});

/** PATCH /api/admin/barbers/reorder: [{ id, sort_order }] untuk semua barber satu cabang. */
export const barberReorderSchema = z
  .array(
    z.object({
      id: z.uuid({ error: 'ID tidak valid.' }),
      sort_order: z.number({ error: 'Urutan harus berupa angka.' }).int().min(0).max(100_000),
    }),
    { error: 'Daftar urutan tidak valid.' },
  )
  .min(1, 'Daftar urutan kosong.')
  .max(200, 'Terlalu banyak item.')
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    error: 'ID tidak boleh dobel.',
  });

export const barberListQuerySchema = z.object({
  branch_id: z.uuid({ error: 'ID cabang tidak valid.' }),
});
