// PATCH /api/admin/users/:id (PRD 4.3, F-22): ubah `role` dan/atau `is_active`. Hanya Super Admin.
// Minimal satu Super Admin aktif harus tersisa. Admin yang dinonaktifkan langsung kehilangan akses
// pada request berikutnya (middleware dan RLS memeriksa `is_active` setiap kali).
import type { APIRoute } from 'astro';
import { patchAdminUser } from '@/lib/admin/users-db';
import { respondDb } from '@/lib/api/db-result';
import { requireSuperAdmin } from '@/lib/api/guards';
import { fail, internalError, readJson, validationFail } from '@/lib/api/respond';
import { getServiceClient } from '@/lib/supabase/service';
import { uuidSchema } from '@/lib/validation/admin-leads';
import { userPatchSchema } from '@/lib/validation/admin-users';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireSuperAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) return fail('NOT_FOUND');
  const parsed = userPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);
  try {
    return respondDb(await patchAdminUser(getServiceClient(), id.data, parsed.data));
  } catch (error) {
    return internalError(error, 'admin/users/:id PATCH');
  }
};
