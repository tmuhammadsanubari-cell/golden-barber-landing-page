// PATCH /api/admin/branches/reorder: simpan urutan [{ id, sort_order }] (PRD 4.3, F-16).
import type { APIRoute } from 'astro';
import { reorderBranches } from '@/lib/admin/branches-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { reorderSchema } from '@/lib/validation/admin-branches';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = reorderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await reorderBranches(locals.supabase, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/branches/reorder PATCH');
  }
};
