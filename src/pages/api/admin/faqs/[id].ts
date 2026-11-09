// PUT / PATCH / DELETE /api/admin/faqs/:id (PRD 4.3, F-21).
// PATCH (saklar tampil) = tambahan kecil di luar PRD untuk edit di daftar.
import type { APIRoute } from 'astro';
import { deleteFaq, patchFaq, updateFaq } from '@/lib/admin/faqs-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { faqCreateSchema, faqPatchSchema } from '@/lib/validation/admin-faqs';
import { uuidSchema } from '@/lib/validation/admin-leads';

export const prerender = false;

function parseId(raw: string | undefined): string | Response {
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : fail('NOT_FOUND');
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  const parsed = faqCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await updateFaq(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/faqs/:id PUT');
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  const parsed = faqPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await patchFaq(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/faqs/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    return respondDb(await deleteFaq(locals.supabase, id));
  } catch (error) {
    return internalError(error, 'admin/faqs/:id DELETE');
  }
};
