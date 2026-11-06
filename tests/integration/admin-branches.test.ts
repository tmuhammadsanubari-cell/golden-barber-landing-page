// Logika data cabang admin (PRD F-16) terhadap database sungguhan, dengan sesi admin nyata
// sehingga RLS ikut diuji. Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env; dilewati bila kosong.
// Menyentuh cabang pusat asli sementara (dipulihkan di afterAll), jadi jalankan terpisah dari e2e.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBranch,
  deleteBranch,
  listBranchItems,
  reorderBranches,
  setBranchActive,
  updateBranch,
} from '@/lib/admin/branches-db';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import { toFormValues } from '@/lib/admin/branches';
import { branchInputSchema, type BranchInput } from '@/lib/validation/admin-branches';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);

const service = getServiceClient();
const RUN = Date.now().toString(36);
const PREFIX = 'UJI-INT Cabang';

/** Rapikan sort_order jadi 1..n sesuai urutan sekarang (seed memakai 1..n; tes M2 membandingkannya). */
async function renumber() {
  const { data } = await service.from('branches').select('id').order('sort_order');
  for (const [index, row] of (data ?? []).entries()) {
    await service
      .from('branches')
      .update({ sort_order: index + 1 })
      .eq('id', row.id);
  }
}

let admin: SupabaseClient<Database>;
let flagshipBefore: string | null = null;

const input = (over: Partial<Record<keyof BranchInput, unknown>> = {}): BranchInput =>
  branchInputSchema.parse({
    name: `${PREFIX} ${RUN}`,
    slug: `uji-int-${RUN}`,
    region: 'bandung_raya',
    address: 'Jl. Uji Integrasi No.1',
    city: 'Kota Bandung',
    province: 'Jawa Barat',
    open_time: '08:00',
    close_time: '23:00',
    is_active: false, // tidak tampil di situs publik
    ...over,
  });

beforeAll(async () => {
  if (!enabled) return;
  const { data } = await service
    .from('branches')
    .select('id')
    .eq('is_flagship', true)
    .maybeSingle();
  flagshipBefore = data?.id ?? null;
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
  await service.from('branches').delete().like('name', `${PREFIX}%`);
  await renumber();
  const { data } = await service.from('branches').select('id').eq('is_flagship', true);
  if (flagshipBefore && !data?.some((b) => b.id === flagshipBefore)) {
    await service.from('branches').update({ is_flagship: false }).eq('is_flagship', true);
    await service.from('branches').update({ is_flagship: true }).eq('id', flagshipBefore);
  }
});

describe.skipIf(!enabled)('data cabang admin (sesi admin sungguhan)', () => {
  let id = '';

  it('buat cabang: di akhir urutan, ketersediaan semua layanan terisi trigger', async () => {
    const before = await listBranchItems(admin);
    const result = await createBranch(admin, input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    id = result.data.id;
    expect(result.data.sort_order).toBeGreaterThan(Math.max(...before.map((b) => b.sort_order)));

    const { count: services } = await service
      .from('services')
      .select('id', { count: 'exact', head: true });
    const { data: filled } = await service
      .from('branch_services')
      .select('status')
      .eq('branch_id', id);
    expect(filled).toHaveLength(services!);
    expect(filled!.every((row) => row.status === 'unavailable')).toBe(true);
  });

  it('slug dobel ditolak CONFLICT (buat dan ubah), data tidak berubah', async () => {
    const created = await createBranch(admin, input({ name: `${PREFIX} dobel ${RUN}` }));
    expect(created).toMatchObject({
      ok: false,
      code: 'CONFLICT',
      message: 'Slug sudah dipakai cabang lain',
    });

    const updated = await updateBranch(admin, id, input({ slug: 'dago' }));
    expect(updated).toMatchObject({
      ok: false,
      code: 'CONFLICT',
      message: 'Slug sudah dipakai cabang lain',
    });
    const { data } = await service.from('branches').select('slug').eq('id', id).single();
    expect(data!.slug).toBe(`uji-int-${RUN}`);
  });

  it('mempertahankan slug sendiri saat ubah (bukan bentrok dengan dirinya)', async () => {
    const result = await updateBranch(admin, id, input({ address: 'Jl. Uji Integrasi No.2' }));
    expect(result.ok).toBe(true);
    const { data } = await service
      .from('branches')
      .select('address, updated_at, created_at')
      .eq('id', id)
      .single();
    expect(data!.address).toBe('Jl. Uji Integrasi No.2');
    // updated_at diperbarui trigger
    expect(new Date(data!.updated_at).getTime()).toBeGreaterThan(
      new Date(data!.created_at).getTime(),
    );
  });

  it('aktifkan/nonaktifkan lewat setBranchActive tanpa mengubah kolom lain', async () => {
    const on = await setBranchActive(admin, id, true);
    expect(on.ok && on.data.is_active).toBe(true);
    const off = await setBranchActive(admin, id, false);
    expect(off.ok && off.data.is_active).toBe(false);
    expect(off.ok && off.data.address).toBe('Jl. Uji Integrasi No.2');
    expect(
      await setBranchActive(admin, '00000000-0000-4000-8000-000000000000', true),
    ).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('ubah id yang tidak ada → NOT_FOUND', async () => {
    const result = await updateBranch(admin, '00000000-0000-4000-8000-000000000000', input());
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('cabang pusat: menjadikan cabang lain pusat melepas yang lama, tetap hanya satu', async () => {
    const result = await updateBranch(admin, id, input({ is_flagship: true }));
    expect(result.ok).toBe(true);
    const { data } = await service.from('branches').select('id').eq('is_flagship', true);
    expect(data!.map((b) => b.id)).toEqual([id]);

    // Memulihkan: pusat lama kembali, cabang uji dilepas.
    if (flagshipBefore) {
      const old = await service.from('branches').select('*').eq('id', flagshipBefore).single();
      const restored = await updateBranch(
        admin,
        flagshipBefore,
        branchInputSchema.parse({ ...toFormValues(old.data!), is_flagship: true }),
      );
      expect(restored.ok).toBe(true);
      const after = await service.from('branches').select('id').eq('is_flagship', true);
      expect(after.data!.map((b) => b.id)).toEqual([flagshipBefore]);
    }
  });

  it('hapus dicegah bila masih ada barber; data tetap ada', async () => {
    const barber = await service
      .from('barbers')
      .insert({ branch_id: id, name: `${PREFIX} barber`, haircut_price: 50000 })
      .select('id')
      .single();
    expect(barber.error).toBeNull();

    const result = await deleteBranch(admin, id);
    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect((result as { message?: string }).message).toContain('masih memiliki barber');
    const { data } = await service.from('branches').select('id').eq('id', id);
    expect(data).toHaveLength(1);

    await service.from('barbers').delete().eq('id', barber.data!.id);
  });

  it('urut ulang: simpan sort_order; daftar yang tidak lengkap ditolak', async () => {
    const items = await listBranchItems(admin);
    const order = items.map((b, i) => ({ id: b.id, sort_order: i + 1 }));
    // Tukar dua terakhir.
    const n = order.length;
    [order[n - 1]!.sort_order, order[n - 2]!.sort_order] = [
      order[n - 2]!.sort_order,
      order[n - 1]!.sort_order,
    ];

    expect(await reorderBranches(admin, order)).toEqual({ ok: true, data: { count: n } });
    const after = await listBranchItems(admin);
    expect(after[n - 1]!.id).toBe(items[n - 2]!.id);
    expect(after[n - 2]!.id).toBe(items[n - 1]!.id);

    const partial = await reorderBranches(admin, order.slice(0, 2));
    expect(partial).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('hapus cabang tanpa barber: baris dan ketersediaannya hilang', async () => {
    const result = await deleteBranch(admin, id);
    expect(result).toEqual({ ok: true, data: { id } });
    const { data } = await service.from('branches').select('id').eq('id', id);
    expect(data).toHaveLength(0);
    const { count } = await service
      .from('branch_services')
      .select('service_id', { count: 'exact', head: true })
      .eq('branch_id', id);
    expect(count).toBe(0);
  });
});

describe('RLS cabang untuk pengunjung (anon)', () => {
  it('anon tidak bisa menulis atau menghapus cabang', async () => {
    const anon = getBuildClient();
    const insert = await anon.from('branches').insert({
      slug: `uji-anon-${RUN}`,
      name: `${PREFIX} anon`,
      region: 'bandung_raya',
      address: 'x',
      city: 'x',
      province: 'x',
    });
    expect(insert.error).not.toBeNull();

    const del = await anon.from('branches').delete().eq('slug', 'dago').select('id');
    expect(del.data ?? []).toHaveLength(0);
    const { data } = await service.from('branches').select('id').eq('slug', 'dago');
    expect(data).toHaveLength(1);
  });
});
