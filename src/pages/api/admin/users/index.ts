// GET /api/admin/users (PRD 4.3, F-22): daftar admin. Hanya Super Admin.
import type { APIRoute } from 'astro';
import { listAdminUsers } from '@/lib/admin/users-db';
import { requireSuperAdmin } from '@/lib/api/guards';
import { internalError, ok } from '@/lib/api/respond';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireSuperAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listAdminUsers(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/users GET');
  }
};
