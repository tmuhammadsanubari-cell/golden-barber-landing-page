// GET /api/admin/settings (PRD 4.3, F-21): semua pengaturan situs { key: value }.
import type { APIRoute } from 'astro';
import { listSettings } from '@/lib/admin/settings-db';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok } from '@/lib/api/respond';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await listSettings(locals.supabase));
  } catch (error) {
    return internalError(error, 'admin/settings GET');
  }
};
