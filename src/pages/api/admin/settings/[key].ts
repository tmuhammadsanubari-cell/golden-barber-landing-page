// PUT /api/admin/settings/:key (PRD 4.3, F-21): ubah satu pengaturan, body { value }.
// Nilai divalidasi dengan skema kuncinya (Zod, sama dengan form). Kunci selain yang boleh
// diubah (`media_mentions`, `seo_defaults`, tak dikenal) → 404.
import type { APIRoute } from 'astro';
import { putSetting } from '@/lib/admin/settings-db';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson, validationFail } from '@/lib/api/respond';
import { getServiceClient } from '@/lib/supabase/service';
import { settingPutSchema } from '@/lib/validation/admin-settings';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const body = settingPutSchema.safeParse(await readJson(request));
  if (!body.success) return validationFail(body.error);
  try {
    return respondDb(
      await putSetting(locals.supabase, getServiceClient(), admin.id, params.key ?? '', body.data.value),
    );
  } catch (error) {
    return internalError(error, 'admin/settings/:key PUT');
  }
};
