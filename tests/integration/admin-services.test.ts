// Logika data layanan & ketersediaan admin (PRD F-18) terhadap database sungguhan dengan sesi admin
// nyata, jadi RLS dan trigger ikut diuji. Layanan dan cabang uji NONAKTIF (tidak tampil di situs).
// Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env; dilewati bila kosong.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyStatusToAll,
  createService,
  deleteService,
  listBranchAvailability,
  listServices,
  patchService,
  reorderServices,
  updateService,
  upsertBranchServices,
} from '@/lib/admin/services-db';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import {
  availabilityBulkSchema,
  serviceCreateSchema,
  servicePatchSchema,
} from '@/lib/validation/admin-services';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);

const service = getServiceClient();
const RUN = Date.now().toString(36);
const PREFIX = 'UJI-INT Layanan';

let admin: SupabaseClient<Database>;
let branchId = '';

const make = (over: Record<string, unknown> = {}) =>
  createService(
    admin,
    serviceCreateSchema.parse({
      name: `${PREFIX} ${RUN}`,
      category: 'hair_treatment',
      price_type: 'fixed',
      price_min: '75K',
      is_active: false,
      ...over,
    }),
  );

const patch = (id: string, body: unknown) =>
  patchService(admin, id, servicePatchSchema.parse(body));
const bulk = (items: unknown) => availabilityBulkSchema.parse(items);

const countRows = async (filter: { branch?: string; service?: string }) => {
  let query = service.from('branch_services').select('service_id', { count: 'exact', head: true });
  if (filter.branch) query = query.eq('branch_id', filter.branch);
  if (filter.service) query = query.eq('service_id', filter.service);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.auth.signInWithPassword({ email: email!, password: password! });
  if (error) throw error;
});

afterAll(async () => {
  if (!enabled) return;
  await service.from('services').delete().like('name', `${PREFIX}%`); // branch_services ikut (cascade)
  await service.from('branches').delete().like('name', `${PREFIX}%`);
});

describe.skipIf(!enabled)('layanan admin (sesi admin sungguhan)', () => {
  let s1 = '';
  let s2 = '';

  it('buat layanan: slug otomatis, di akhir kategori, ketersediaan semua cabang terisi trigger', async () => {
    const before = (await listServices(admin)).filter((s) => s.category === 'hair_treatment');
    const result = await make();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    s1 = result.data.id;
    expect(result.data.slug).toBe(`uji-int-layanan-${RUN}`);
    expect(result.data.sort_order).toBe(Math.max(...before.map((s) => s.sort_order)) + 1);

    const { count: branches } = await service
      .from('branches')
      .select('id', { count: 'exact', head: true });
    expect(await countRows({ service: s1 })).toBe(branches);
    const { data } = await service.from('branch_services').select('status').eq('service_id', s1);
    expect(data!.every((row) => row.status === 'unavailable')).toBe(true);
  });

  it('nama kembar: slug diberi sufiks, tidak bentrok', async () => {
    const result = await make();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    s2 = result.data.id;
    expect(result.data.slug).toBe(`uji-int-layanan-${RUN}-2`);
  });

  it('cabang baru otomatis dapat ketersediaan semua layanan (trigger), status tidak tersedia', async () => {
    const { data, error } = await service
      .from('branches')
      .insert({
        slug: `uji-int-layanan-cb-${RUN}`,
        name: `${PREFIX} cabang ${RUN}`,
        region: 'bandung_raya',
        address: 'Jl. Uji Integrasi',
        city: 'Kota Bandung',
        province: 'Jawa Barat',
        is_active: false,
        sort_order: 900,
      })
      .select('id')
      .single();
    if (error) throw error;
    branchId = data.id;
    const { count: services } = await service
      .from('services')
      .select('id', { count: 'exact', head: true });
    expect(await countRows({ branch: branchId })).toBe(services);
    const rows = await listBranchAvailability(admin, branchId);
    expect(rows.every((row) => row.status === 'unavailable')).toBe(true);
  });

  it('ubah tipe harga: Rentang wajib harga maks; kembali ke Tetap mengosongkan harga maks', async () => {
    const noMax = await patch(s1, { price_type: 'range' });
    expect(noMax).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect((noMax as { details: Record<string, string> }).details).toHaveProperty('price_max');

    const tooLow = await patch(s1, { price_type: 'range', price_max: 70000 });
    expect(tooLow).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });

    const range = await patch(s1, { price_type: 'range', price_max: '150K' });
    expect(range.ok && range.data).toMatchObject({
      price_type: 'range',
      price_min: 75000,
      price_max: 150000,
    });

    // Menaikkan harga min sampai menyentuh maks ditolak; data tetap.
    expect(await patch(s1, { price_min: 150000 })).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    const fixed = await patch(s1, { price_type: 'fixed' });
    expect(fixed.ok && fixed.data).toMatchObject({ price_type: 'fixed', price_max: null });
    const row = (await listServices(admin)).find((s) => s.id === s1)!;
    expect(row).toMatchObject({ price_type: 'fixed', price_min: 75000, price_max: null });
  });

  it('edit penuh (PUT): slug tetap, semua field berubah', async () => {
    const before = (await listServices(admin)).find((s) => s.id === s1)!;
    const result = await updateService(
      admin,
      s1,
      serviceCreateSchema.parse({
        name: `${PREFIX} ${RUN} baru`,
        category: 'hair_treatment',
        price_type: 'start_from',
        price_min: '90K',
        price_max: '999K',
        note: 'Catatan',
        description: 'Deskripsi',
        is_active: false,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      slug: before.slug,
      name: `${PREFIX} ${RUN} baru`,
      price_type: 'start_from',
      price_min: 90000,
      price_max: null,
      note: 'Catatan',
    });
  });

  it('pindah kategori: ditaruh di akhir kategori tujuan', async () => {
    const result = await patch(s2, { category: 'add_on' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const addOns = (await listServices(admin)).filter((s) => s.category === 'add_on');
    expect(result.data.sort_order).toBe(Math.max(...addOns.map((s) => s.sort_order)));
    expect(addOns[addOns.length - 1]!.id).toBe(s2);
    await patch(s2, { category: 'hair_treatment' });
  });

  it('ubah id yang tidak ada → NOT_FOUND', async () => {
    expect(
      await patch('00000000-0000-4000-8000-000000000000', { name: 'Layanan X' }),
    ).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('urut ulang: satu kategori penuh; tidak lengkap, campur kategori, atau tak dikenal ditolak', async () => {
    const group = (await listServices(admin)).filter((s) => s.category === 'hair_treatment');
    const reversed = [...group].reverse().map((s, index) => ({ id: s.id, sort_order: index + 1 }));
    expect(await reorderServices(admin, reversed)).toEqual({
      ok: true,
      data: { count: group.length },
    });
    const after = (await listServices(admin)).filter((s) => s.category === 'hair_treatment');
    expect(after.map((s) => s.id)).toEqual([...group].reverse().map((s) => s.id));

    // pulihkan urutan asli (seed memakai sort_order 1..n per kategori)
    await reorderServices(
      admin,
      group.map((s) => ({ id: s.id, sort_order: s.sort_order })),
    );

    expect(await reorderServices(admin, reversed.slice(0, 2))).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
    const other = (await listServices(admin)).find((s) => s.category === 'add_on')!;
    expect(
      await reorderServices(admin, [
        { id: s1, sort_order: 1 },
        { id: other.id, sort_order: 2 },
      ]),
    ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(
      await reorderServices(admin, [{ id: '00000000-0000-4000-8000-000000000000', sort_order: 1 }]),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('bulk upsert ketersediaan satu cabang: status dan harga khusus; tanpa baris dobel', async () => {
    const result = await upsertBranchServices(
      admin,
      branchId,
      bulk([
        {
          service_id: s1,
          status: 'available',
          price_override_min: '85K',
          price_override_max: '100K',
        },
        { service_id: s2, status: 'soon' },
      ]),
    );
    expect(result.ok).toBe(true);
    const rows = await listBranchAvailability(admin, branchId);
    expect(rows.find((r) => r.service_id === s1)).toMatchObject({
      status: 'available',
      price_override_min: 85000,
      price_override_max: 100000,
    });
    expect(rows.find((r) => r.service_id === s2)).toMatchObject({
      status: 'soon',
      price_override_min: null,
    });

    // Upsert ulang: tidak menambah baris; harga khusus yang tidak dikirim dikosongkan.
    const before = await countRows({ branch: branchId });
    await upsertBranchServices(admin, branchId, bulk([{ service_id: s1, status: 'soon' }]));
    expect(await countRows({ branch: branchId })).toBe(before);
    const row = (await listBranchAvailability(admin, branchId)).find((r) => r.service_id === s1)!;
    expect(row).toMatchObject({
      status: 'soon',
      price_override_min: null,
      price_override_max: null,
    });
  });

  it('bulk upsert: cabang atau layanan tidak ada ditolak', async () => {
    expect(
      await upsertBranchServices(
        admin,
        '00000000-0000-4000-8000-000000000000',
        bulk([{ service_id: s1, status: 'available' }]),
      ),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    const unknown = await upsertBranchServices(
      admin,
      branchId,
      bulk([{ service_id: '00000000-0000-4000-8000-000000000000', status: 'available' }]),
    );
    expect(unknown).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('terapkan ke semua cabang: status sama di semua cabang, harga khusus tetap', async () => {
    await upsertBranchServices(
      admin,
      branchId,
      bulk([{ service_id: s1, status: 'unavailable', price_override_min: 88000 }]),
    );
    const result = await applyStatusToAll(admin, s1, 'available');
    const { count: branches } = await service
      .from('branches')
      .select('id', { count: 'exact', head: true });
    expect(result).toEqual({ ok: true, data: { count: branches } });
    const { data } = await service
      .from('branch_services')
      .select('status, price_override_min, branch_id')
      .eq('service_id', s1);
    expect(data!.every((row) => row.status === 'available')).toBe(true);
    expect(data!.find((row) => row.branch_id === branchId)!.price_override_min).toBe(88000);

    expect(
      await applyStatusToAll(admin, '00000000-0000-4000-8000-000000000000', 'soon'),
    ).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('hapus layanan: baris dan ketersediaannya hilang; hapus lagi → NOT_FOUND', async () => {
    expect(await deleteService(admin, s1)).toEqual({ ok: true, data: { id: s1 } });
    expect(await countRows({ service: s1 })).toBe(0);
    expect((await listServices(admin)).some((s) => s.id === s1)).toBe(false);
    expect(await deleteService(admin, s1)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    await deleteService(admin, s2);
  });
});

describe('RLS layanan untuk pengunjung (anon)', () => {
  it('anon tidak bisa mengubah layanan atau ketersediaan', async () => {
    const anon = getBuildClient();
    const { data: real } = await service
      .from('services')
      .select('id, price_min')
      .eq('slug', 'trim')
      .single();

    const update = await anon
      .from('services')
      .update({ price_min: 10000 })
      .eq('id', real!.id)
      .select('id');
    expect(update.data ?? []).toHaveLength(0);
    const { data: rows } = await service
      .from('branch_services')
      .select('branch_id, status')
      .eq('service_id', real!.id)
      .limit(1);
    const status = await anon
      .from('branch_services')
      .update({ status: 'unavailable' })
      .eq('branch_id', rows![0]!.branch_id)
      .eq('service_id', real!.id)
      .select('status');
    expect(status.data ?? []).toHaveLength(0);

    const { data: after } = await service
      .from('services')
      .select('price_min')
      .eq('id', real!.id)
      .single();
    expect(after!.price_min).toBe(real!.price_min);
  });
});
