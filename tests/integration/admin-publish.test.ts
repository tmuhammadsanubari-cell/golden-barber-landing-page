// Publikasi (PRD F-20) terhadap database sungguhan dengan sesi admin nyata. Deploy Hook DIGANTI
// fetch palsu: tes ini tidak pernah memicu build Vercel. Baris publish_logs uji dihapus di akhir.
// Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env; dilewati bila kosong.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { listPublishHistory, loadPublishStatus, triggerPublish } from '@/lib/admin/publish-db';
import { createService, deleteService } from '@/lib/admin/services-db';
import { getServiceClient } from '@/lib/supabase/service';
import { serviceCreateSchema } from '@/lib/validation/admin-services';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);

const service = getServiceClient();
const RUN = Date.now().toString(36);
const STARTED = new Date();
const HOOK = 'https://hook.invalid/uji';

let admin: SupabaseClient<Database>;
let adminId = '';
const fakeFetch = (status: number) => {
  const mock = vi.fn(async () => new Response('{}', { status }));
  return { mock, fetchImpl: mock as unknown as typeof fetch };
};

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.auth.signInWithPassword({
    email: email!,
    password: password!,
  });
  if (error) throw error;
  adminId = data.user.id;
});

afterAll(async () => {
  if (!enabled) return;
  await service
    .from('publish_logs')
    .delete()
    .eq('triggered_by', adminId)
    .gte('created_at', STARTED.toISOString());
  await service.from('services').delete().like('name', `UJI-INT Publikasi ${RUN}%`);
});

describe.skipIf(!enabled)('publikasi (sesi admin sungguhan)', () => {
  it('Deploy Hook belum diisi → PUBLISH_FAILED, tercatat failed, tidak mengunci', async () => {
    const result = await triggerPublish(admin, service, adminId, { hookUrl: undefined });
    expect(result).toMatchObject({ ok: false, code: 'PUBLISH_FAILED' });
    const status = await loadPublishStatus(admin, service);
    expect(status.last_publish?.status).toBe('failed');
    expect(status.cooldown_seconds_left).toBe(0);
  });

  it('hook membalas 500 → PUBLISH_FAILED dengan kode tercatat, boleh coba lagi', async () => {
    const { fetchImpl } = fakeFetch(500);
    const result = await triggerPublish(admin, service, adminId, { hookUrl: HOOK, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'PUBLISH_FAILED' });
    const [latest] = await listPublishHistory(admin, service, 1);
    expect(latest).toMatchObject({ status: 'failed', response_code: 500 });
    expect(latest!.error_message).not.toContain('invalid');
  });

  it('hook sukses → triggered, tercatat, kunci 60 detik; picu ulang ditolak tanpa memanggil hook', async () => {
    const first = fakeFetch(201);
    const result = await triggerPublish(admin, service, adminId, {
      hookUrl: HOOK,
      fetchImpl: first.fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(first.mock).toHaveBeenCalledTimes(1);

    const status = await loadPublishStatus(admin, service);
    expect(status.last_publish).toMatchObject({ status: 'triggered' });
    expect(status.last_success_at).not.toBeNull();
    expect(status.cooldown_seconds_left).toBeGreaterThan(50);

    const again = fakeFetch(201);
    const blocked = await triggerPublish(admin, service, adminId, {
      hookUrl: HOOK,
      fetchImpl: again.fetchImpl,
    });
    expect(blocked).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(again.mock).not.toHaveBeenCalled();
  });

  it('setelah 60 detik boleh lagi', async () => {
    const later = fakeFetch(201);
    const result = await triggerPublish(admin, service, adminId, {
      hookUrl: HOOK,
      fetchImpl: later.fetchImpl,
      now: new Date(Date.now() + 61_000),
    });
    expect(result.ok).toBe(true);
    expect(later.mock).toHaveBeenCalledTimes(1);
  });

  it('mengubah konten setelah publikasi → belum dipublikasikan; menyebut tabelnya', async () => {
    const before = await loadPublishStatus(admin, service);
    const created = await createService(
      admin,
      serviceCreateSchema.parse({
        name: `UJI-INT Publikasi ${RUN}`,
        category: 'hair_treatment',
        price_type: 'fixed',
        price_min: '75K',
        is_active: false,
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const after = await loadPublishStatus(admin, service);
    expect(after.has_unpublished_changes).toBe(true);
    expect(after.changed_tables).toContain('services');
    expect(after.changed_tables).toContain('branch_services'); // trigger mengisi ketersediaan
    expect(after.pending_count).toBeGreaterThan(before.pending_count);
    await deleteService(admin, created.data.id);
  });

  it('riwayat memuat nama pemicu', async () => {
    const rows = await listPublishHistory(admin, service, 5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.triggered_by_name).toBeTruthy();
  });
});
