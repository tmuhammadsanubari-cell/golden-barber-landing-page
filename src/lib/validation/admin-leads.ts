// Skema query dan ubah lead untuk panel admin (PRD F-19). Pesan Bahasa Indonesia.
import { z } from 'zod';

const blankToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

export const leadQuerySchema = z.object({
  type: z.preprocess(blankToUndefined, z.enum(['academy', 'partnership']).optional()),
  status: z.preprocess(blankToUndefined, z.enum(['new', 'contacted', 'closed', 'spam']).optional()),
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
  id: z.preprocess(blankToUndefined, z.uuid().optional()),
});

export type LeadQuery = z.output<typeof leadQuerySchema>;

export const leadPatchSchema = z
  .object({
    status: z
      .enum(['new', 'contacted', 'closed', 'spam'], { error: 'Status tidak dikenal.' })
      .optional(),
    admin_note: z
      .string({ error: 'Catatan harus berupa teks.' })
      .max(2000, 'Catatan maksimal 2000 karakter.')
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.admin_note !== undefined, {
    error: 'Tidak ada perubahan yang dikirim.',
  });

export const uuidSchema = z.uuid({ error: 'ID tidak valid.' });
