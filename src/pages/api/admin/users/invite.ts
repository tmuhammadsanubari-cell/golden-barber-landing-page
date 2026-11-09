// POST /api/admin/users/invite (PRD 4.3, F-22): undang admin baru lewat email (Supabase
// inviteUserByEmail). Hanya Super Admin. Body { email, full_name, role }.
import type { APIRoute } from 'astro';
import { inviteRedirectUrl } from '@/lib/admin/users';
import { inviteAdminUser } from '@/lib/admin/users-db';
import { respondDb } from '@/lib/api/db-result';
import { requireSuperAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { env } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/service';
import { inviteSchema } from '@/lib/validation/admin-users';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireSuperAdmin(locals);
  if (admin instanceof Response) return admin;
  const parsed = inviteSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    const redirectTo = inviteRedirectUrl(env('PUBLIC_SITE_URL'), new URL(request.url).origin);
    return respondDb(await inviteAdminUser(getServiceClient(), parsed.data, redirectTo), 201);
  } catch (error) {
    return internalError(error, 'admin/users/invite POST');
  }
};
