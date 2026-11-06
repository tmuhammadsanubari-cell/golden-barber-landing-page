// POST /api/admin/barbers/:id/move { branch_id }: pindah barber ke cabang lain (PRD 4.3, F-17).
import type { APIRoute } from 'astro';
import { moveBarber } from '@/lib/admin/barbers-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { moveSchema } from '@/lib/validation/admin-barbers';
import { uuidSchema } from '@/lib/validation/admin-leads';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return fail('NOT_FOUND');

  const parsed = moveSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await moveBarber(locals.supabase, id.data, parsed.data.branch_id));
  } catch (error) {
    return internalError(error, 'admin/barbers/:id/move POST');
  }
};
