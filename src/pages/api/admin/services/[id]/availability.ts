// PUT /api/admin/services/:id/availability { status }: terapkan status ke semua cabang (PRD 4.3, F-18).
import type { APIRoute } from 'astro';
import { applyStatusToAll } from '@/lib/admin/services-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { uuidSchema } from '@/lib/validation/admin-leads';
import { applyAllSchema } from '@/lib/validation/admin-services';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return fail('NOT_FOUND');

  const parsed = applyAllSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await applyStatusToAll(locals.supabase, id.data, parsed.data.status));
  } catch (error) {
    return internalError(error, 'admin/services/:id/availability PUT');
  }
};
