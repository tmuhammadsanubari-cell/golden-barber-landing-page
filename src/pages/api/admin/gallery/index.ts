// GET / POST /api/admin/gallery (PRD 4.3, F-21). Gambar diunggah dulu lewat /api/admin/uploads.
import type { APIRoute } from 'astro';
import { createGalleryItem, listGallery } from '@/lib/admin/gallery-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { galleryCreateSchema } from '@/lib/validation/admin-gallery';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listGallery(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/gallery GET');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const parsed = galleryCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await createGalleryItem(locals.supabase, parsed.data), 201);
  } catch (error) {
    return internalError(error, 'admin/gallery POST');
  }
};
