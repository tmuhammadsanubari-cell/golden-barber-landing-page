// GET / POST /api/admin/faqs (PRD 4.3, F-21).
import type { APIRoute } from 'astro';
import { createFaq, listFaqs } from '@/lib/admin/faqs-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { faqCreateSchema } from '@/lib/validation/admin-faqs';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listFaqs(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/faqs GET');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const parsed = faqCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await createFaq(locals.supabase, parsed.data), 201);
  } catch (error) {
    return internalError(error, 'admin/faqs POST');
  }
};
