// POST /api/admin/publish (PRD 4.3, F-20): picu Vercel Deploy Hook, catat ke publish_logs.
// Super Admin dan Editor boleh (PRD 4.4). Kunci 60 detik setelah publikasi sukses.
import type { APIRoute } from 'astro';
import { triggerPublish } from '@/lib/admin/publish-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError } from '@/lib/api/respond';
import { env } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/service';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  try {
    const result = await triggerPublish(locals.supabase, getServiceClient(), admin.id, {
      hookUrl: env('VERCEL_DEPLOY_HOOK_URL'),
    });
    return respondDb(result);
  } catch (error) {
    return internalError(error, 'admin/publish POST');
  }
};
