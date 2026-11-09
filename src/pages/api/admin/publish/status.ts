// GET /api/admin/publish/status (PRD 4.3, F-20): ada perubahan belum tayang? kapan publikasi terakhir?
import type { APIRoute } from 'astro';
import { loadPublishStatus } from '@/lib/admin/publish-db';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, ok } from '@/lib/api/respond';
import { getServiceClient } from '@/lib/supabase/service';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    return ok(await loadPublishStatus(locals.supabase, getServiceClient()));
  } catch (error) {
    return internalError(error, 'admin/publish/status GET');
  }
};
