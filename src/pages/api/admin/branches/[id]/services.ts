// GET / PUT /api/admin/branches/:id/services: ketersediaan layanan satu cabang; PUT = bulk upsert (PRD F-18).
import type { APIRoute } from 'astro';
import { listBranchAvailability, upsertBranchServices } from '@/lib/admin/services-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { uuidSchema } from '@/lib/validation/admin-leads';
import { availabilityBulkSchema } from '@/lib/validation/admin-services';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return fail('NOT_FOUND');
  try {
    return ok(await listBranchAvailability(locals.supabase, id.data));
  } catch (error) {
    return internalError(error, 'admin/branches/:id/services GET');
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return fail('NOT_FOUND');

  const parsed = availabilityBulkSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await upsertBranchServices(locals.supabase, id.data, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/branches/:id/services PUT');
  }
};
