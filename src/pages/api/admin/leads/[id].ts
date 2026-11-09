// GET / PATCH / DELETE /api/admin/leads/:id (PRD 4.3, F-19).
import type { APIRoute } from 'astro';
import { requireAdmin, requireSuperAdmin } from '@/lib/api/guards';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { getLead } from '@/lib/admin/leads-db';
import { leadPatchSchema, uuidSchema } from '@/lib/validation/admin-leads';

export const prerender = false;

function parseId(raw: string | undefined): string | Response {
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : fail('NOT_FOUND');
}

export const GET: APIRoute = async ({ params, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  try {
    const lead = await getLead(locals.supabase, id);
    return lead ? ok(lead) : fail('NOT_FOUND');
  } catch (error) {
    return internalError(error, 'admin/leads/:id GET');
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  const parsed = leadPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationFail(parsed.error);

  try {
    // handled_by mencatat admin yang terakhir mengubah; updated_at diisi trigger.
    const { data, error } = await locals.supabase
      .from('leads')
      .update({ ...parsed.data, handled_by: admin.id })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? ok(data) : fail('NOT_FOUND');
  } catch (error) {
    return internalError(error, 'admin/leads/:id PATCH');
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const admin = requireSuperAdmin(locals);
  if (admin instanceof Response) return admin;
  const id = parseId(params.id);
  if (id instanceof Response) return id;

  try {
    const { data, error } = await locals.supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return data ? ok({ id: data.id }) : fail('NOT_FOUND');
  } catch (error) {
    return internalError(error, 'admin/leads/:id DELETE');
  }
};
