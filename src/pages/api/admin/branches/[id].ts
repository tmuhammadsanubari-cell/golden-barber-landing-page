// GET / PUT / PATCH / DELETE /api/admin/branches/:id (PRD 4.3, F-16).
// PATCH (hanya `is_active`) = tambahan kecil di luar PRD, untuk aktif/nonaktif dari menu baris.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { deleteBranch, getBranchRow, setBranchActive, updateBranch } from '@/lib/admin/branches-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { uuidSchema } from '@/lib/validation/admin-leads';
import { branchInputSchema } from '@/lib/validation/admin-branches';

export const prerender = false;

const activeSchema = z.object({ is_active: z.boolean({ error: 'Status tidak valid.' }) });

function parseId(raw: string | undefined): string | Response {
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : fail('NOT_FOUND');
}

export const GET: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    const row = await getBranchRow(locals.supabase, id);
    return row ? ok(row) : fail('NOT_FOUND');
  } catch (error) {
    return internalError(error, 'admin/branches/:id GET');
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  const parsed = branchInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await updateBranch(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/branches/:id PUT');
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  const parsed = activeSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await setBranchActive(locals.supabase, id, parsed.data.is_active));
  } catch (error) {
    return internalError(error, 'admin/branches/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    return respondDb(await deleteBranch(locals.supabase, id));
  } catch (error) {
    return internalError(error, 'admin/branches/:id DELETE');
  }
};
