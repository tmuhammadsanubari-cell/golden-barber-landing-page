// GET / POST /api/admin/branches (PRD 4.3, F-16).
import type { APIRoute } from 'astro';
import { listBranchItems, createBranch } from '@/lib/admin/branches-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { branchInputSchema } from '@/lib/validation/admin-branches';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listBranchItems(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/branches GET');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const parsed = branchInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);

  try {
    return respondDb(await createBranch(locals.supabase, parsed.data), 201);
  } catch (error) {
    return internalError(error, 'admin/branches POST');
  }
};
