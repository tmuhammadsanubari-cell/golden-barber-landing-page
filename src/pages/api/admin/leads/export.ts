// GET /api/admin/leads/export?type=&status=&q= — unduh CSV (UTF-8 + BOM), mengikuti filter aktif.
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/api/guards';
import { internalError, validationFail } from '@/lib/api/respond';
import { CSV_BOM, CSV_HEADER, csvFilename, csvRow } from '@/lib/admin/leads';
import { iterateLeads } from '@/lib/admin/leads-db';
import { leadQuerySchema } from '@/lib/validation/admin-leads';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;

  const query = leadQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return validationFail(query.error);
  const { type, status, q } = query.data;

  try {
    const encoder = new TextEncoder();
    const iterator = iterateLeads(locals.supabase, { type, status, q });
    // Ambil batch pertama sebelum membalas, supaya error database jadi 500 JSON, bukan CSV rusak.
    const first = await iterator.next();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(CSV_BOM + CSV_HEADER.join(',') + '\r\n'));
          let step = first;
          while (!step.done) {
            controller.enqueue(encoder.encode(step.value.map(csvRow).join('\r\n') + '\r\n'));
            step = await iterator.next();
          }
          controller.close();
        } catch (error) {
          console.error('[api] admin/leads/export stream', error);
          controller.error(error);
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename(type ?? null)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return internalError(error, 'admin/leads/export');
  }
};
