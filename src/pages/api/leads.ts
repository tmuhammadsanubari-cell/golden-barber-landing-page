// POST /api/leads (PRD 3.4.1): simpan lead Academy / Kemitraan. Publik, tanpa login.
// Insert lewat service role; RLS tidak memberi anon akses ke tabel leads.
import type { APIRoute } from 'astro';
import {
  buildLeadRow,
  cleanSourcePath,
  hashIp,
  isHoneypotFilled,
  parseRateLimit,
} from '@/lib/api/leads';
import { clientIp } from '@/lib/api/redirect';
import { fail, internalError, ok, readJson, validationFail } from '@/lib/api/respond';
import { env, requireEnv } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase/service';
import { leadSchema } from '@/lib/validation/lead';

export const prerender = false;

const HOUR_MS = 60 * 60 * 1000;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await readJson(request);
  if (typeof body !== 'object' || body === null) return fail('VALIDATION_ERROR');

  // Honeypot terisi: sukses palsu, tidak disimpan (PRD F-06).
  if (isHoneypotFilled(body)) return ok({ id: null }, { status: 201 });

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return validationFail(parsed.error);

  try {
    const ipHash = hashIp(clientIp({ clientAddress }), requireEnv('LEAD_IP_SALT'));
    const limit = parseRateLimit(env('LEAD_RATE_LIMIT_PER_HOUR'));
    const service = getServiceClient();

    const since = new Date(Date.now() - HOUR_MS).toISOString();
    const { count, error: countError } = await service
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count ?? 0) >= limit) return fail('RATE_LIMITED');

    const row = buildLeadRow(parsed.data, {
      ipHash,
      userAgent: request.headers.get('user-agent'),
      sourcePath: cleanSourcePath((body as Record<string, unknown>).source_path),
    });
    const { data, error } = await service.from('leads').insert(row).select('id').single();
    if (error) throw error;
    return ok({ id: data.id }, { status: 201 });
  } catch (error) {
    return internalError(error, 'leads');
  }
};
