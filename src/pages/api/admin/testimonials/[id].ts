// PUT / PATCH / DELETE /api/admin/testimonials/:id (PRD 4.3, F-21).
// PATCH (saklar tampil / label contoh) = tambahan kecil di luar PRD untuk edit di daftar.
import type { APIRoute } from 'astro';
import {
  deleteTestimonial,
  patchTestimonial,
  updateTestimonial,
} from '@/lib/admin/testimonials-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { uuidSchema } from '@/lib/validation/admin-leads';
import {
  testimonialCreateSchema,
  testimonialPatchSchema,
} from '@/lib/validation/admin-testimonials';

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
  const parsed = testimonialCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await updateTestimonial(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/testimonials/:id PUT');
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  const parsed = testimonialPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await patchTestimonial(locals.supabase, id, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/testimonials/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;
  try {
    return respondDb(await deleteTestimonial(locals.supabase, id));
  } catch (error) {
    return internalError(error, 'admin/testimonials/:id DELETE');
  }
};
