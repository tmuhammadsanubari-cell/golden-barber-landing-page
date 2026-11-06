// GET / POST /api/admin/services (PRD 4.3, F-18). POST otomatis membuat ketersediaan semua cabang (trigger).
import type { APIRoute } from 'astro';
import { createService, listServices } from '@/lib/admin/services-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { serviceCreateSchema } from '@/lib/validation/admin-services';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listServices(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/services GET');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = serviceCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await createService(locals.supabase, parsed.data), 201);
  } catch (error) {
    return internalError(error, 'admin/services POST');
  }
};
