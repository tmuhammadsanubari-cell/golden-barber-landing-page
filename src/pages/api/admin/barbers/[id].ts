// PATCH / DELETE /api/admin/barbers/:id (PRD 4.3, F-17). PATCH menerima sebagian field.
import type { APIRoute } from 'astro';
import { deleteBarber, patchBarber } from '@/lib/admin/barbers-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { barberPatchSchema } from '@/lib/validation/admin-barbers';
import { uuidSchema } from '@/lib/validation/admin-leads';

export const prerender = false;

function parseId(raw: string | undefined): string | Response {
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : fail('NOT_FOUND');
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  const parsed = barberPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await patchBarber(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/barbers/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    return respondDb(await deleteBarber(locals.supabase, id));
  } catch (error) {
    return internalError(error, 'admin/barbers/:id DELETE');
  }
};
