// PUT / PATCH / DELETE /api/admin/gallery/:id (PRD 4.3, F-21). DELETE ikut menghapus berkas di
// storage; PUT yang mengganti gambar menghapus berkas lama. PATCH = tambahan kecil di luar PRD
// (edit inline judul/tampil).
import type { APIRoute } from 'astro';
import { deleteGalleryItem, patchGalleryItem, updateGalleryItem } from '@/lib/admin/gallery-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { getServiceClient } from '@/lib/supabase/service';
import { uuidSchema } from '@/lib/validation/admin-leads';
import { galleryCreateSchema, galleryPatchSchema } from '@/lib/validation/admin-gallery';

export const prerender = false;

function parseId(raw: string | undefined): string | Response {
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : fail('NOT_FOUND');
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  const parsed = galleryCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await updateGalleryItem(locals.supabase, getServiceClient(), id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/gallery/:id PUT');
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  const parsed = galleryPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await patchGalleryItem(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/gallery/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    return respondDb(await deleteGalleryItem(locals.supabase, getServiceClient(), id));
  } catch (error) {
    return internalError(error, 'admin/gallery/:id DELETE');
  }
};
