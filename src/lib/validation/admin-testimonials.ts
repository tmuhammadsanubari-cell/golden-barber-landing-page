// Skema testimoni untuk panel admin (PRD F-21). Dipakai client dan server.
import { z } from 'zod';

export const SOURCES = ['google', 'instagram', 'langsung'] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  google: 'Google',
  instagram: 'Instagram',
  langsung: 'Langsung',
};

export const CONTENT_MAX = 500;

const customerName = z
  .string({ error: 'Nama pelanggan wajib diisi.' })
  .trim()
  .min(1, 'Nama pelanggan wajib diisi.')
  .min(2, 'Nama pelanggan minimal 2 karakter.')
  .max(60, 'Nama pelanggan maksimal 60 karakter.');

/** "" (pilihan "Semua cabang") → null. */
const branchId = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.uuid({ error: 'Cabang tidak valid.' }).nullable(),
);

const rating = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
  z
    .number({ error: 'Pilih rating 1 sampai 5.' })
    .int('Pilih rating 1 sampai 5.')
    .min(1, 'Pilih rating 1 sampai 5.')
    .max(5, 'Pilih rating 1 sampai 5.'),
);

const content = z
  .string({ error: 'Isi testimoni wajib diisi.' })
  .trim()
  .min(1, 'Isi testimoni wajib diisi.')
  .max(CONTENT_MAX, `Isi testimoni maksimal ${CONTENT_MAX} karakter.`);

const source = z.enum(SOURCES, { error: 'Pilih sumber testimoni.' });

export const testimonialCreateSchema = z.object({
  customer_name: customerName,
  branch_id: branchId.optional().transform((value) => value ?? null),
  rating,
  content,
  source,
  is_placeholder: z.boolean({ error: 'Label contoh tidak valid.' }).default(false),
  is_active: z.boolean({ error: 'Status tampil tidak valid.' }).default(true),
});

export type TestimonialCreate = z.output<typeof testimonialCreateSchema>;

/** PATCH: hanya dua saklar di daftar. Field lain lewat PUT (form). */
export const testimonialPatchSchema = z
  .object({
    is_active: z.boolean({ error: 'Status tampil tidak valid.' }),
    is_placeholder: z.boolean({ error: 'Label contoh tidak valid.' }),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'Tidak ada yang diubah.' });

export type TestimonialPatch = z.output<typeof testimonialPatchSchema>;
