// Logika data barber admin (PRD F-17) terhadap database sungguhan dengan sesi admin nyata, jadi
// RLS ikut diuji. Memakai dua cabang uji NONAKTIF (tidak tampil di situs); data asli tidak disentuh.
// Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env; dilewati bila kosong.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBarber,
  deleteBarber,
  listBarbers,
  moveBarber,
  patchBarber,
  reorderBarbers,
} from '@/lib/admin/barbers-db';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import { barberCreateSchema, barberPatchSchema } from '@/lib/validation/admin-barbers';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);

const service = getServiceClient();
const RUN = Date.now().toString(36);
const PREFIX = 'UJI-INT Barber';

let admin: SupabaseClient<Database>;
let branchA = '';
let branchB = '';

async function makeBranch(suffix: string): Promise<string> {
  const { data, error } = await service
    .from('branches')
    .insert({
      slug: `uji-int-barber-${suffix.toLowerCase()}-${RUN}`,
      name: `${PREFIX} ${suffix} ${RUN}`,
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
  return data.id;
}

const create = (over: Record<string, unknown> = {}, branch = branchA) =>
  createBarber(
    admin,
    barberCreateSchema.parse({
      branch_id: branch,
      name: 'Uji',
      haircut_price: '100K',
      is_active: false, // tidak dihitung dashboard "Barber Aktif"
      ...over,
    }),
  );

const patch = (id: string, body: unknown) => patchBarber(admin, id, barberPatchSchema.parse(body));

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.auth.signInWithPassword({ email: email!, password: password! });
  if (error) throw error;
  branchA = await makeBranch('A');
  branchB = await makeBranch('B');
});

afterAll(async () => {
  if (!enabled) return;
  // barbers → branches memakai on delete restrict: hapus barber dulu.
  await service.from('barbers').delete().in('branch_id', [branchA, branchB].filter(Boolean));
  await service.from('branches').delete().like('name', `${PREFIX}%`);
});

describe.skipIf(!enabled)('data barber admin (sesi admin sungguhan)', () => {
  let a1 = '';
  let a2 = '';
  let a3 = '';

  it('tambah barber: urutan di akhir cabang, harga dinormalisasi', async () => {
    const first = await create({ name: 'Satu', haircut_price: '130K', long_trim_price: '150.000' });
    const second = await create({ name: 'Dua' });
    const third = await create({ name: 'Tiga' });
    expect(first.ok && second.ok && third.ok).toBe(true);
    if (!first.ok || !second.ok || !third.ok) return;
    [a1, a2, a3] = [first.data.id, second.data.id, third.data.id];
    expect(first.data).toMatchObject({
      haircut_price: 130000,
      long_trim_price: 150000,
      sort_order: 1,
    });
    expect(second.data.sort_order).toBe(2);
    expect(third.data.sort_order).toBe(3);
  });

  it('cabang yang tidak ada → VALIDATION_ERROR di branch_id', async () => {
    const result = await create({}, '00000000-0000-4000-8000-000000000000');
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect((result as { details?: Record<string, string> }).details).toHaveProperty('branch_id');
  });

  it('dua "By Barber" di satu cabang dengan harga berbeda diizinkan', async () => {
    const one = await create({
      name: 'By Barber',
      is_generic: true,
      label: 'Tier 1',
      haircut_price: '100K',
    });
    const two = await create({
      name: 'By Barber',
      is_generic: true,
      label: 'Tier 2',
      haircut_price: '85K',
    });
    expect(one.ok && two.ok).toBe(true);
    const list = await listBarbers(admin, branchA);
    expect(list.filter((b) => b.is_generic)).toHaveLength(2);
    if (one.ok) await deleteBarber(admin, one.data.id);
    if (two.ok) await deleteBarber(admin, two.data.id);
  });

  it('ubah harga sebagian field: lainnya tetap; updated_at diperbarui trigger', async () => {
    const before = (await listBarbers(admin, branchA)).find((b) => b.id === a1)!;
    const result = await patch(a1, { haircut_price: '120K', haircut_original_price: 150000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      haircut_price: 120000,
      haircut_original_price: 150000,
      long_trim_price: 150000,
      name: 'Satu',
    });
    // updated_at maju karena trigger (bukan dikirim klien).
    expect(new Date(result.data.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime(),
    );
  });

  it('harga coret harus lebih besar: ditolak dan data tidak berubah', async () => {
    const same = await patch(a1, { haircut_original_price: 120000 });
    expect(same).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect((same as { details: Record<string, string> }).details.haircut_original_price).toContain(
      'lebih besar',
    );

    // Menurunkan coret di bawah harga aktual juga ditolak.
    expect(await patch(a1, { haircut_original_price: 100000 })).toMatchObject({ ok: false });

    // Menaikkan harga aktual hingga ≥ harga coret yang ada ditolak, pesan di kolom yang bermasalah.
    const raise = await patch(a1, { haircut_price: 150000 });
    expect(raise).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect((raise as { details: Record<string, string> }).details).toHaveProperty(
      'haircut_original_price',
    );

    const row = (await listBarbers(admin, branchA)).find((b) => b.id === a1)!;
    expect(row).toMatchObject({ haircut_price: 120000, haircut_original_price: 150000 });
  });

  it('harga coret Long Trim butuh harga Long Trim', async () => {
    const result = await patch(a2, { long_trim_original_price: 170000 });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    const ok = await patch(a2, { long_trim_price: 140000, long_trim_original_price: 170000 });
    expect(ok.ok).toBe(true);
    // Mengosongkan harga Long Trim sambil menyisakan coretnya ditolak.
    expect(await patch(a2, { long_trim_price: null })).toMatchObject({ ok: false });
    // Mengosongkan keduanya sekaligus boleh.
    const cleared = await patch(a2, { long_trim_price: null, long_trim_original_price: null });
    expect(cleared.ok && cleared.data.long_trim_price).toBeNull();
  });

  it('batas harga di database: kurang dari Rp10.000 ditolak skema, bukan lolos ke DB', () => {
    expect(barberPatchSchema.safeParse({ haircut_price: 9000 }).success).toBe(false);
    expect(barberPatchSchema.safeParse({ haircut_price: 10_000_001 }).success).toBe(false);
  });

  it('aktif/nonaktif, nama, label', async () => {
    const result = await patch(a3, { name: 'Tiga Baru', label: 'Senior', is_generic: true });
    expect(result.ok && result.data).toMatchObject({
      name: 'Tiga Baru',
      label: 'Senior',
      is_generic: true,
    });
    const blank = await patch(a3, { label: '' });
    expect(blank.ok && blank.data.label).toBeNull();
    const off = await patch(a3, { is_active: false });
    expect(off.ok && off.data.is_active).toBe(false);
  });

  it('ubah id yang tidak ada → NOT_FOUND', async () => {
    expect(await patch('00000000-0000-4000-8000-000000000000', { name: 'X' })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('urut ulang: tersimpan; daftar tidak lengkap atau campur cabang ditolak', async () => {
    const list = await listBarbers(admin, branchA);
    expect(list.map((b) => b.id)).toEqual([a1, a2, a3]);

    const reversed = [a3, a2, a1].map((id, index) => ({ id, sort_order: index + 1 }));
    expect(await reorderBarbers(admin, reversed)).toEqual({ ok: true, data: { count: 3 } });
    expect((await listBarbers(admin, branchA)).map((b) => b.id)).toEqual([a3, a2, a1]);

    const partial = await reorderBarbers(admin, reversed.slice(0, 2));
    expect(partial).toMatchObject({ ok: false, code: 'CONFLICT' });

    const other = await create({ name: 'Cabang B' }, branchB);
    if (!other.ok) throw new Error('gagal membuat barber cabang B');
    const mixed = await reorderBarbers(admin, [
      { id: a1, sort_order: 1 },
      { id: other.data.id, sort_order: 2 },
    ]);
    expect(mixed).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(
      await reorderBarbers(admin, [{ id: '00000000-0000-4000-8000-000000000000', sort_order: 1 }]),
    ).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
    await deleteBarber(admin, other.data.id);
  });

  it('pindah cabang: di akhir cabang tujuan; cabang sama atau tidak ada ditolak', async () => {
    const existingInB = await create({ name: 'Sudah di B' }, branchB);
    expect(existingInB.ok).toBe(true);

    const moved = await moveBarber(admin, a2, branchB);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.data.branch_id).toBe(branchB);
    expect(moved.data.sort_order).toBe(2);
    expect(moved.data.haircut_price).toBe(100000); // harga ikut pindah
    expect((await listBarbers(admin, branchA)).map((b) => b.id)).toEqual([a3, a1]);

    expect(await moveBarber(admin, a2, branchB)).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await moveBarber(admin, a1, '00000000-0000-4000-8000-000000000000')).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await moveBarber(admin, '00000000-0000-4000-8000-000000000000', branchA)).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('hapus: baris hilang; hapus lagi → NOT_FOUND', async () => {
    expect(await deleteBarber(admin, a1)).toEqual({ ok: true, data: { id: a1 } });
    const { data } = await service.from('barbers').select('id').eq('id', a1);
    expect(data).toHaveLength(0);
    expect(await deleteBarber(admin, a1)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });
});

describe('RLS barber untuk pengunjung (anon)', () => {
  it('anon tidak bisa mengubah atau menghapus barber', async () => {
    const anon = getBuildClient();
    const { data: real } = await service
      .from('barbers')
      .select('id, haircut_price')
      .eq('is_active', true)
      .limit(1);
    const target = real![0]!;

    const update = await anon
      .from('barbers')
      .update({ haircut_price: 10000 })
      .eq('id', target.id)
      .select('id');
    expect(update.data ?? []).toHaveLength(0);
    const del = await anon.from('barbers').delete().eq('id', target.id).select('id');
    expect(del.data ?? []).toHaveLength(0);

    const { data } = await service
      .from('barbers')
      .select('haircut_price')
      .eq('id', target.id)
      .single();
    expect(data!.haircut_price).toBe(target.haircut_price);
  });
});
