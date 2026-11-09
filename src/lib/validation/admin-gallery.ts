// Skema galeri & unggahan untuk panel admin (PRD F-21). Dipakai client dan server.
import { z } from 'zod';
import {
  UPLOAD_FOLDERS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  isSitePath,
  isStoragePath,
} from '@/lib/media';
import { reorderSchema } from './admin-order';

export const GALLERY_MESSAGES = {
  altRequired: 'Alt text wajib diisi sebelum gambar ditampilkan di situs.',
};

const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z
      .string({ error: `${label} harus berupa teks.` })
      .trim()
      .max(max, `${label} maksimal ${max} karakter.`)
      .nullable(),
  );

const title = z
  .string({ error: 'Judul gaya wajib diisi.' })
  .trim()
  .min(2, 'Judul gaya minimal 2 karakter.')
  .max(80, 'Judul gaya maksimal 80 karakter.');

const altText = z
  .string({ error: 'Alt text harus berupa teks.' })
  .trim()
  .max(200, 'Alt text maksimal 200 karakter.');

const imagePath = z
  .string({ error: 'Gambar wajib diunggah.' })
  .refine((value) => isStoragePath(value) || isSitePath(value), {
    error: 'Path gambar tidak valid. Unggah ulang gambarnya.',
  });

/** Aturan lintas-kolom: gambar aktif wajib punya alt text (PRD F-21). Kunci = nama kolom. */
export function checkGallery(state: {
  is_active: boolean;
  alt_text: string;
}): Record<string, string> {
  if (state.is_active && state.alt_text.trim() === '') {
    return { alt_text: GALLERY_MESSAGES.altRequired };
  }
  return {};
}

export const galleryCreateSchema = z
  .object({
    title,
    description: optionalText('Deskripsi', 300).optional().transform((value) => value ?? null),
    image_path: imagePath,
    alt_text: altText.default(''),
    is_placeholder: z.boolean({ error: 'Label ilustrasi tidak valid.' }).default(false),
    is_active: z.boolean({ error: 'Status tampil tidak valid.' }).default(true),
  })
  .superRefine((value, ctx) => {
    for (const [path, message] of Object.entries(checkGallery(value))) {
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  });

export type GalleryCreate = z.output<typeof galleryCreateSchema>;

/** PATCH: sebagian field untuk edit inline (judul, tampil) dan dialog detail. */
export const galleryPatchSchema = z
  .object({
    title,
    description: optionalText('Deskripsi', 300),
    alt_text: altText,
    is_placeholder: z.boolean({ error: 'Label ilustrasi tidak valid.' }),
    is_active: z.boolean({ error: 'Status tampil tidak valid.' }),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'Tidak ada yang diubah.' });

export type GalleryPatch = z.output<typeof galleryPatchSchema>;

export const galleryReorderSchema = reorderSchema;

/** POST /api/admin/uploads (PRD 4.3): minta URL unggah bertanda tangan. */
export const uploadRequestSchema = z.object({
  folder: z.enum(UPLOAD_FOLDERS, { error: 'Folder tidak dikenal.' }),
  content_type: z.enum(Object.keys(UPLOAD_TYPES) as [keyof typeof UPLOAD_TYPES], {
    error: 'Format file harus JPG, PNG, atau WebP.',
  }),
  size: z
    .number({ error: 'Ukuran file tidak valid.' })
    .int('Ukuran file tidak valid.')
    .min(1, 'File kosong.')
    .max(UPLOAD_MAX_BYTES, 'Ukuran file maksimal 3 MB.'),
});

export type UploadRequest = z.output<typeof uploadRequestSchema>;
