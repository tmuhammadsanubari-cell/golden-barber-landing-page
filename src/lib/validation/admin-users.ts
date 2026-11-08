// Skema pengguna admin (PRD F-22). Dipakai client dan server.
import { z } from 'zod';

export const ROLES = ['super_admin', 'editor'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  editor: 'Editor',
};

const email = z
  .string({ error: 'Email wajib diisi.' })
  .trim()
  .toLowerCase()
  .min(1, 'Email wajib diisi.')
  .max(254, 'Email maksimal 254 karakter.')
  .pipe(z.email({ error: 'Format email tidak valid.' }));

const fullName = z
  .string({ error: 'Nama lengkap wajib diisi.' })
  .trim()
  .min(1, 'Nama lengkap wajib diisi.')
  .min(2, 'Nama lengkap minimal 2 karakter.')
  .max(80, 'Nama lengkap maksimal 80 karakter.');

const role = z.enum(ROLES, { error: 'Pilih peran Super Admin atau Editor.' });

/** POST /api/admin/users/invite */
export const inviteSchema = z.object({ email, full_name: fullName, role });
export type InviteInput = z.output<typeof inviteSchema>;

/** PATCH /api/admin/users/:id: ubah peran dan/atau status akses. */
export const userPatchSchema = z
  .object({
    role,
    is_active: z.boolean({ error: 'Status akses tidak valid.' }),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'Tidak ada yang diubah.' });
export type UserPatch = z.output<typeof userPatchSchema>;
