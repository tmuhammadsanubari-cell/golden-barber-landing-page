// GET / POST /api/admin/testimonials (PRD 4.3, F-21).
import type { APIRoute } from 'astro';
import { createTestimonial, listTestimonials } from '@/lib/admin/testimonials-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { testimonialCreateSchema } from '@/lib/validation/admin-testimonials';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listTestimonials(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/testimonials GET');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const parsed = testimonialCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await createTestimonial(locals.supabase, parsed.data), 201);
  } catch (error) {
    return internalError(error, 'admin/testimonials POST');
  }
};
