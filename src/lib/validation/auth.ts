// Skema auth admin (PRD F-14). Pesan Bahasa Indonesia; dipakai client & server.
import { z } from 'zod';

const email = z
  .string({ error: 'Email wajib diisi.' })
  .trim()
  .min(1, 'Email wajib diisi.')
  .pipe(z.email({ error: 'Format email tidak valid.' }));

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password wajib diisi.' }).min(1, 'Password wajib diisi.'),
  remember: z.boolean().optional(),
  redirect: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const PASSWORD_MIN = 8;

export const resetPasswordSchema = z
  .object({
    password: z
      .string({ error: 'Password baru wajib diisi.' })
      .min(PASSWORD_MIN, `Password minimal ${PASSWORD_MIN} karakter.`)
      .max(72, 'Password maksimal 72 karakter.'),
    confirm: z.string({ error: 'Ulangi password baru.' }),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    error: 'Konfirmasi password tidak sama.',
  });
