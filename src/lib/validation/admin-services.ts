// Skema layanan & ketersediaan untuk panel admin (PRD F-18). Dipakai client dan server.
import { z } from 'zod';
import { optionalPrice, requiredPrice } from './admin-barbers';

export const CATEGORIES = ['add_on', 'hair_colouring', 'hair_treatment'] as const;
export const PRICE_TYPES = ['fixed', 'start_from', 'range'] as const;
export const STATUSES = ['available', 'soon', 'unavailable'] as const;

export const SERVICE_MESSAGES = {
  rangeNeedsMax: 'Isi harga maksimum untuk tipe Rentang.',
  rangeMaxGreater: 'Harga maksimum harus lebih besar dari harga minimum.',
  overrideNeedsMin: 'Isi harga minimum dulu sebelum harga maksimum.',
  overrideMaxGreater: 'Harga maksimum harus lebih besar dari harga minimum.',
};

export interface ServicePriceState {
  price_type: (typeof PRICE_TYPES)[number];
  price_min: number;
  price_max: number | null;
}

/** Aturan lintas-kolom: tipe Rentang wajib punya maks > min. Kunci = nama kolom. */
export function checkServicePrice(state: ServicePriceState): Record<string, string> {
  if (state.price_type !== 'range') return {};
  if (state.price_max === null) return { price_max: SERVICE_MESSAGES.rangeNeedsMax };
  if (state.price_max <= state.price_min) return { price_max: SERVICE_MESSAGES.rangeMaxGreater };
  return {};
}

/** Tipe Tetap / Mulai dari mengabaikan harga maksimum (PRD F-18). */
export function normalizeServicePrice<T extends ServicePriceState>(state: T): T {
  return state.price_type === 'range' ? state : { ...state, price_max: null };
}

const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z
      .string({ error: `${label} harus berupa teks.` })
      .trim()
      .max(max, `${label} maksimal ${max} karakter.`)
      .nullable(),
  );

const name = z
  .string({ error: 'Nama layanan wajib diisi.' })
  .trim()
  .min(2, 'Nama layanan minimal 2 karakter.')
  .max(80, 'Nama layanan maksimal 80 karakter.');

const category = z.enum(CATEGORIES, { error: 'Pilih kategori.' });
const priceType = z.enum(PRICE_TYPES, { error: 'Pilih tipe harga.' });

export const serviceCreateSchema = z
  .object({
    name,
    category,
    price_type: priceType,
    price_min: requiredPrice('Harga'),
    price_max: optionalPrice.optional().transform((value) => value ?? null),
    note: optionalText('Catatan', 80)
      .optional()
      .transform((value) => value ?? null),
    description: optionalText('Deskripsi', 500)
      .optional()
      .transform((value) => value ?? null),
    is_active: z.boolean({ error: 'Nilai tidak valid.' }).default(true),
  })
  .superRefine((value, ctx) => {
    for (const [path, message] of Object.entries(checkServicePrice(value))) {
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  })
  .transform(normalizeServicePrice);

export type ServiceCreate = z.output<typeof serviceCreateSchema>;

/** PATCH sebagian field (tipe harga, tampil, dan sebagainya). Aturan lintas-kolom dicek pada data gabungan. */
export const servicePatchSchema = z
  .object({
    name: name.optional(),
    category: category.optional(),
    price_type: priceType.optional(),
    price_min: requiredPrice('Harga').optional(),
    price_max: optionalPrice.optional(),
    note: optionalText('Catatan', 80).optional(),
    description: optionalText('Deskripsi', 500).optional(),
    is_active: z.boolean({ error: 'Nilai tidak valid.' }).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Tidak ada perubahan yang dikirim.',
  });

export type ServicePatch = z.output<typeof servicePatchSchema>;

export const serviceReorderSchema = z
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

export const statusSchema = z.enum(STATUSES, { error: 'Status tidak dikenal.' });

export const applyAllSchema = z.object({ status: statusSchema });

/** Harga khusus per cabang: min saja, atau min + maks (maks > min). Kosong = pakai harga katalog. */
export function checkOverride(min: number | null, max: number | null): Record<string, string> {
  if (max !== null && min === null)
    return { price_override_min: SERVICE_MESSAGES.overrideNeedsMin };
  if (min !== null && max !== null && max <= min) {
    return { price_override_max: SERVICE_MESSAGES.overrideMaxGreater };
  }
  return {};
}

export const availabilityItemSchema = z
  .object({
    service_id: z.uuid({ error: 'ID layanan tidak valid.' }),
    status: statusSchema,
    price_override_min: optionalPrice.optional().transform((value) => value ?? null),
    price_override_max: optionalPrice.optional().transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    for (const [path, message] of Object.entries(
      checkOverride(value.price_override_min, value.price_override_max),
    )) {
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  });

export type AvailabilityItem = z.output<typeof availabilityItemSchema>;

/** PUT /api/admin/branches/:id/services: bulk upsert per cabang (PRD F-18). */
export const availabilityBulkSchema = z
  .array(availabilityItemSchema, { error: 'Daftar ketersediaan tidak valid.' })
  .min(1, 'Daftar kosong.')
  .max(100, 'Terlalu banyak item.')
  .refine((items) => new Set(items.map((item) => item.service_id)).size === items.length, {
    error: 'Layanan tidak boleh dobel.',
  });
