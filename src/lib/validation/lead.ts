// Skema form lead Academy & Kemitraan (PRD F-06, F-07). Dipakai client (M1) & server (/api/leads, M3).
// Memakai `zod/mini` (API fungsional, bisa di-tree-shake) karena skema ini ikut ke bundle publik
// LeadForm; anggaran JS halaman publik < 80 KB gzip (NFR-001, D-38). Skema admin tetap `zod`.
import { z } from 'zod/mini';
import { normalizePhone } from '@/lib/whatsapp';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const text = (label: string) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .check(
      z.trim(),
      z.minLength(2, `${label} minimal 2 karakter.`),
      z.maxLength(100, `${label} maksimal 100 karakter.`),
    );

const base = {
  full_name: text('Nama'),
  whatsapp_number: z
    .pipe(z.string({ error: 'Nomor WhatsApp wajib diisi.' }), z.transform(normalizePhone))
    .check(
      z.refine((value) => /^62\d{8,13}$/.test(value), {
        error: 'Nomor WhatsApp harus 10–15 digit dan diawali 08 atau 62.',
      }),
    ),
  message: z.pipe(
    z.transform(emptyToUndefined),
    z.optional(z.string().check(z.trim(), z.maxLength(1000, 'Pesan maksimal 1000 karakter.'))),
  ),
  consent: z.literal(true, { error: 'Centang persetujuan untuk melanjutkan.' }),
  // Honeypot: diisi bot. Server M3 mengembalikan sukses palsu tanpa menyimpan.
  website: z.optional(z.string()),
};

export const academyLeadSchema = z.object({
  ...base,
  type: z.literal('academy'),
  city: text('Kota domisili'),
  age: z.pipe(
    z.transform(emptyToUndefined),
    z.optional(
      z.coerce
        .number({ error: 'Usia harus berupa angka.' })
        .check(
          z.int('Usia harus berupa angka bulat.'),
          z.gte(15, 'Usia minimal 15 tahun.'),
          z.lte(60, 'Usia maksimal 60 tahun.'),
        ),
    ),
  ),
  experience: z.enum(['belum_pernah', 'dasar', 'sudah_bekerja'], {
    error: 'Pilih pengalaman mencukur.',
  }),
});

export const partnershipLeadSchema = z.object({
  ...base,
  type: z.literal('partnership'),
  city: text('Kota rencana lokasi'),
  email: z.pipe(
    z.transform(emptyToUndefined),
    z.optional(z.email({ error: 'Format email tidak valid.' })),
  ),
  location_status: z.enum(['sudah_ada', 'belum_ada'], { error: 'Pilih status lokasi.' }),
});

export const leadSchema = z.discriminatedUnion('type', [academyLeadSchema, partnershipLeadSchema]);

export type LeadInput = z.infer<typeof leadSchema>;
export type LeadType = LeadInput['type'];

/** Peta error Zod ke `{ field: pesan }`, pesan pertama per field (PRD 4.5). */
export function zodToDetails(error: {
  issues: readonly z.core.$ZodIssue[];
}): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    details[field] ??= issue.message;
  }
  return details;
}
