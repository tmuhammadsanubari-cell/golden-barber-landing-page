// PATCH /api/admin/services/reorder: simpan urutan [{ id, sort_order }] satu kategori (F-18).
import type { APIRoute } from 'astro';
import { reorderServices } from '@/lib/admin/services-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { serviceReorderSchema } from '@/lib/validation/admin-services';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = serviceReorderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await reorderServices(locals.supabase, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/services/reorder PATCH');
  }
};
