// POST /api/admin/uploads (PRD 4.3, F-21): minta URL unggah bertanda tangan untuk satu gambar.
// Body { folder, content_type, size }. Server memeriksa tipe (JPG/PNG/WebP) dan ukuran (≤ 3 MB).
import type { APIRoute } from 'astro';
import { requestSignedUpload } from '@/lib/admin/uploads';
import { respondDb } from '@/lib/api/db-result';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, readJson } from '@/lib/api/respond';
import { requireEnv } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/service';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const body = await readJson(request);
  const raw = typeof body === 'object' && body !== null ? body : {};
  try {
    return respondDb(
      await requestSignedUpload(getServiceClient(), requireEnv('PUBLIC_SUPABASE_URL'), raw),
    );
  } catch (error) {
    return internalError(error, 'admin/uploads POST');
  }
};
