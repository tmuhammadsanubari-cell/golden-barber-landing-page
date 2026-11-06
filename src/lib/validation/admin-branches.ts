// Skema cabang untuk panel admin (PRD F-16). Dipakai form (client) dan endpoint (server).
// Pesan Bahasa Indonesia. Isian opsional yang dikosongkan menjadi `null` (kolom DB nullable).
import { z } from 'zod';
import { normalizePhone } from '@/lib/whatsapp';

const blank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
    ? null
    : value;

/** Teks opsional: kosong → null. */
const optionalText = (label: string, max: number) =>
  z.preprocess(
    blank,
    z
      .string({ error: `${label} harus berupa teks.` })
      .trim()
      .max(max, `${label} maksimal ${max} karakter.`)
      .nullable(),
  );

const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(min, min === 1 ? `${label} wajib diisi.` : `${label} minimal ${min} karakter.`)
    .max(max, `${label} maksimal ${max} karakter.`);

const httpsUrl = (label: string) =>
  optionalText(label, 500).refine((value) => {
    if (value === null) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, `${label} harus berupa tautan https:// yang valid.`);

const EMBED_PREFIX = 'https://www.google.com/maps/embed';

const time = (label: string) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} harus berformat JJ:MM, mis. 08:00.`);

const coordinate = (label: string, min: number, max: number) =>
  z.preprocess(
    blank,
    z.coerce
      .number({ error: `${label} harus berupa angka.` })
      .min(min, `${label} minimal ${min}.`)
      .max(max, `${label} maksimal ${max}.`)
      .nullable(),
  );

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const branchInputSchema = z
  .object({
    name: requiredText('Nama cabang', 2, 80),
    slug: z
      .string({ error: 'Slug wajib diisi.' })
      .trim()
      .min(2, 'Slug minimal 2 karakter.')
      .max(60, 'Slug maksimal 60 karakter.')
      .regex(SLUG_PATTERN, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.'),
    region: z.enum(['bandung_raya', 'jabodetabek'], { error: 'Pilih wilayah.' }),
    address: requiredText('Alamat jalan', 3, 200),
    district: optionalText('Kecamatan', 100),
    city: requiredText('Kota/Kabupaten', 2, 100),
    province: requiredText('Provinsi', 2, 100),
    postal_code: z.preprocess(
      blank,
      z
        .string({ error: 'Kode pos harus berupa angka.' })
        .trim()
        .regex(/^\d{5}$/, 'Kode pos harus 5 digit angka.')
        .nullable(),
    ),
    address_incomplete: z.boolean({ error: 'Nilai tidak valid.' }).default(false),
    maps_url: httpsUrl('URL Google Maps'),
    maps_embed_url: optionalText('URL embed peta', 800).refine(
      (value) => value === null || value.startsWith(EMBED_PREFIX),
      `URL embed harus diawali ${EMBED_PREFIX} — salin dari Bagikan › Sematkan peta.`,
    ),
    latitude: coordinate('Latitude', -90, 90),
    longitude: coordinate('Longitude', -180, 180),
    open_time: time('Jam buka'),
    close_time: time('Jam tutup'),
    whatsapp_number: z.preprocess(
      blank,
      z
        .string({ error: 'Nomor WhatsApp harus berupa teks.' })
        .transform(normalizePhone)
        .refine((value) => /^62\d{8,13}$/.test(value), {
          error: 'Nomor WhatsApp harus 10–15 digit dan diawali 08 atau 62.',
        })
        .nullable(),
    ),
    is_flagship: z.boolean({ error: 'Nilai tidak valid.' }).default(false),
    is_new: z.boolean({ error: 'Nilai tidak valid.' }).default(false),
    is_active: z.boolean({ error: 'Nilai tidak valid.' }).default(true),
    internal_note: optionalText('Catatan internal', 1000),
  })
  .superRefine((value, ctx) => {
    if (value.close_time <= value.open_time) {
      ctx.addIssue({
        code: 'custom',
        path: ['close_time'],
        message: 'Jam tutup harus lebih besar dari jam buka.',
      });
    }
    if ((value.latitude === null) !== (value.longitude === null)) {
      ctx.addIssue({
        code: 'custom',
        path: [value.latitude === null ? 'latitude' : 'longitude'],
        message: 'Isi latitude dan longitude bersamaan, atau kosongkan keduanya.',
      });
    }
  });

export type BranchInput = z.output<typeof branchInputSchema>;

/** `PATCH /api/admin/branches/reorder`: [{ id, sort_order }] (PRD 4.3). */
export const reorderSchema = z
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

export const branchFilterSchema = z.object({
  filter: z.preprocess(blank, z.enum(['aktif', 'baru', 'nonaktif']).nullable()),
  q: z.preprocess(blank, z.string().trim().max(100).nullable()),
  id: z.preprocess(blank, z.uuid().nullable()),
  baru: z.preprocess(blank, z.literal('1').nullable()),
});
