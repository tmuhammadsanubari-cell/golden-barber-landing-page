// PATCH /api/admin/barbers/reorder: simpan urutan [{ id, sort_order }] satu cabang (PRD 4.3, F-17).
import type { APIRoute } from 'astro';
import { reorderBarbers } from '@/lib/admin/barbers-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { barberReorderSchema } from '@/lib/validation/admin-barbers';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = barberReorderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await reorderBarbers(locals.supabase, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/barbers/reorder PATCH');
  }
};
