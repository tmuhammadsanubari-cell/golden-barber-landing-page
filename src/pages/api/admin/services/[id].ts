// PUT / PATCH / DELETE /api/admin/services/:id (PRD 4.3, F-18).
// PATCH (sebagian field: tipe harga, tampil) = tambahan kecil di luar PRD untuk edit inline.
import type { APIRoute } from 'astro';
import { deleteService, patchService, updateService } from '@/lib/admin/services-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { uuidSchema } from '@/lib/validation/admin-leads';
import { serviceCreateSchema, servicePatchSchema } from '@/lib/validation/admin-services';

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

  const parsed = serviceCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await updateService(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/services/:id PUT');
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  const parsed = servicePatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await patchService(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/services/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    return respondDb(await deleteService(locals.supabase, id));
  } catch (error) {
    return internalError(error, 'admin/services/:id DELETE');
  }
};
