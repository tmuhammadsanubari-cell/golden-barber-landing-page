// Skema urut ulang yang sama untuk daftar konten (galeri, testimoni, FAQ): [{ id, sort_order }].
import { z } from 'zod';

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
