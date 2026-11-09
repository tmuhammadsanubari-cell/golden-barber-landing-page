// GET /api/admin/leads?type=&status=&q=&page= — daftar lead terfilter, 25 per halaman.
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok, validationFail } from '@/lib/api/respond';
import { PAGE_SIZE } from '@/lib/admin/leads';
import { listLeads } from '@/lib/admin/leads-db';
import { leadQuerySchema } from '@/lib/validation/admin-leads';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const query = leadQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return validationFail(query.error);

  try {
    const { type, status, q, page } = query.data;
    const { rows, total } = await listLeads(locals.supabase, { type, status, q }, page);
    return ok({ leads: rows, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return internalError(error, 'admin/leads GET');
  }
};
