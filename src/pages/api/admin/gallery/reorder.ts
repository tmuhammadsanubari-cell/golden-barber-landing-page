// PATCH /api/admin/gallery/reorder: simpan urutan [{ id, sort_order }] semua item galeri (F-21).
import type { APIRoute } from 'astro';
import { reorderGallery } from '@/lib/admin/gallery-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { galleryReorderSchema } from '@/lib/validation/admin-gallery';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const parsed = galleryReorderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await reorderGallery(locals.supabase, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/gallery/reorder PATCH');
  }
};
