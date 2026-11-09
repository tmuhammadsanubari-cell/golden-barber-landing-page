// GET / POST /api/admin/barbers (PRD 4.3, F-17).
import type { APIRoute } from 'astro';
import { createBarber, listBarbers } from '@/lib/admin/barbers-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { barberCreateSchema, barberListQuerySchema } from '@/lib/validation/admin-barbers';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = barberListQuerySchema.safeParse({
    branch_id: url.searchParams.get('branch_id') ?? undefined,
  });
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return ok(await listBarbers(locals.supabase, parsed.data.branch_id));
  } catch (error) {
    return internalError(error, 'admin/barbers GET');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = barberCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await createBarber(locals.supabase, parsed.data), 201);
  } catch (error) {
    return internalError(error, 'admin/barbers POST');
  }
};
