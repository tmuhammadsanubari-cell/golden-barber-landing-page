// Skema form lead Academy & Kemitraan (PRD F-06, F-07). Dipakai client (M1) & server (/api/leads, M3).
import { z } from 'zod';
import { normalizePhone } from '@/lib/whatsapp';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const text = (label: string) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(2, `${label} minimal 2 karakter.`)
    .max(100, `${label} maksimal 100 karakter.`);

const base = {
  full_name: text('Nama'),
  whatsapp_number: z
    .string({ error: 'Nomor WhatsApp wajib diisi.' })
    .transform(normalizePhone)
    .refine((value) => /^62\d{8,13}$/.test(value), {
      error: 'Nomor WhatsApp harus 10–15 digit dan diawali 08 atau 62.',
    }),
  message: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000, 'Pesan maksimal 1000 karakter.').optional(),
  ),
  consent: z.literal(true, { error: 'Centang persetujuan untuk melanjutkan.' }),
  // Honeypot: diisi bot. Server M3 mengembalikan sukses palsu tanpa menyimpan.
  website: z.string().optional(),
};

export const academyLeadSchema = z.object({
  ...base,
  type: z.literal('academy'),
  city: text('Kota domisili'),
  age: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: 'Usia harus berupa angka.' })
      .int('Usia harus berupa angka bulat.')
      .min(15, 'Usia minimal 15 tahun.')
      .max(60, 'Usia maksimal 60 tahun.')
      .optional(),
  ),
  experience: z.enum(['belum_pernah', 'dasar', 'sudah_bekerja'], {
    error: 'Pilih pengalaman mencukur.',
  }),
});

export const partnershipLeadSchema = z.object({
  ...base,
  type: z.literal('partnership'),
  city: text('Kota rencana lokasi'),
  email: z.preprocess(
    emptyToUndefined,
    z.email({ error: 'Format email tidak valid.' }).optional(),
  ),
  location_status: z.enum(['sudah_ada', 'belum_ada'], { error: 'Pilih status lokasi.' }),
});

export const leadSchema = z.discriminatedUnion('type', [academyLeadSchema, partnershipLeadSchema]);

export type LeadInput = z.infer<typeof leadSchema>;
export type LeadType = LeadInput['type'];

/** Peta error Zod ke `{ field: pesan }`, pesan pertama per field (PRD 4.5). */
export function zodToDetails(error: z.ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    details[field] ??= issue.message;
  }
  return details;
}
