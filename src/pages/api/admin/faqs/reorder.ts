// PATCH /api/admin/faqs/reorder: simpan urutan [{ id, sort_order }] semua FAQ (F-21).
import type { APIRoute } from 'astro';
import { reorderFaqs } from '@/lib/admin/faqs-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { reorderSchema } from '@/lib/validation/admin-order';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const parsed = reorderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await reorderFaqs(locals.supabase, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/faqs/reorder PATCH');
  }
};
