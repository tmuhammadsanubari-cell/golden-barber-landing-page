// Pengguna admin (PRD F-22) terhadap Supabase sungguhan: undang (pengirim email DIGANTI, tidak ada
// email terkirim), ubah peran/status, Super Admin terakhir, dan batas hak Editor (RLS) dengan akun
// Editor sungguhan. Akun Super Admin asli TIDAK pernah diubah. Akun uji dihapus di akhir.
// Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env; dilewati bila kosong.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activeSuperAdmins } from '@/lib/admin/users';
import {
  inviteAdminUser,
  listAdminUsers,
  patchAdminUser,
  type Inviter,
} from '@/lib/admin/users-db';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import { inviteSchema, userPatchSchema } from '@/lib/validation/admin-users';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const ANON = process.env.PUBLIC_SUPABASE_ANON_KEY!;

const service = getServiceClient();
const RUN = Date.now().toString(36);
const EDITOR_EMAIL = `uji-int-${RUN}-editor@example.com`;
const EDITOR_PASSWORD = `Uji-${RUN}-Aa1!x`;
const createdAuthIds: string[] = [];
const REDIRECT = 'http://localhost:4321/admin/reset-password';

let admin: SupabaseClient<Database>;
let adminId = '';
let editor: SupabaseClient<Database>;
let editorId = '';
let testLeadId = '';

/** Pengganti undangan: membuat akun Auth terkonfirmasi dengan password uji, tanpa mengirim email. */
const fakeInviter: Inviter = async ({ email: address }) => {
  const { data, error } = await service.auth.admin.createUser({
    email: address,
    password: EDITOR_PASSWORD,
    email_confirm: true,
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) return { error: 'ALREADY_REGISTERED' };
    throw error;
  }
  createdAuthIds.push(data.user.id);
  return { id: data.user.id };
};

const invite = (over: Record<string, unknown> = {}, inviter: Inviter = fakeInviter) =>
  inviteAdminUser(
    service,
    inviteSchema.parse({ email: EDITOR_EMAIL, full_name: 'UJI-INT Editor', role: 'editor', ...over }),
    REDIRECT,
    inviter,
  );

const profile = async (id: string) => {
  const { data, error } = await service.from('admin_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.signInWithPassword({ email: email!, password: password! });
  if (error) throw error;
  adminId = data.user.id;
});

afterAll(async () => {
  if (!enabled) return;
  if (testLeadId) await service.from('leads').delete().eq('id', testLeadId);
  for (const id of createdAuthIds) await service.auth.admin.deleteUser(id); // profil ikut (cascade)
  await service.from('admin_profiles').delete().like('email', `uji-int-${RUN}-%`);
});

describe.skipIf(!enabled)('pengguna admin (sesi Super Admin sungguhan)', () => {
  it('daftar: Super Admin membaca semua admin, termasuk dirinya', async () => {
    const users = await listAdminUsers(admin);
    expect(users.some((user) => user.id === adminId && user.role === 'super_admin')).toBe(true);
  });

  it('undang: akun Auth + profil aktif dengan peran dipilih; email dinormalkan', async () => {
    const result = await invite({ email: EDITOR_EMAIL.toUpperCase() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    editorId = result.data.id;
    expect(result.data).toMatchObject({
      email: EDITOR_EMAIL,
      full_name: 'UJI-INT Editor',
      role: 'editor',
      is_active: true,
    });
    expect(await profile(editorId)).not.toBeNull();
  });

  it('undang email yang sama (profil ada, atau Auth menolak) → CONFLICT tanpa membuat akun baru', async () => {
    let called = 0;
    const counting: Inviter = async (args) => {
      called += 1;
      return fakeInviter(args);
    };
    expect(await invite({}, counting)).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(called).toBe(0); // dicegah sebelum memanggil Auth

    const alreadyRegistered: Inviter = async () => ({ error: 'ALREADY_REGISTERED' });
    expect(await invite({ email: `uji-int-${RUN}-lain@example.com` }, alreadyRegistered)).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
  });

  it('profil gagal dibuat → akun Auth yang baru dibuat dihapus (tidak yatim)', async () => {
    const orphanEmail = `uji-int-${RUN}-yatim@example.com`;
    // Lewati skema: peran tak sah ditolak database saat profil dibuat.
    await expect(
      inviteAdminUser(
        service,
        { email: orphanEmail, full_name: 'UJI-INT Yatim', role: 'bogus' as never },
        REDIRECT,
        fakeInviter,
      ),
    ).rejects.toBeDefined();
    const { data } = await service.auth.admin.listUsers({ perPage: 200 });
    expect(data.users.some((user) => user.email === orphanEmail)).toBe(false);
  });

  it('Editor: bisa masuk; hanya melihat profilnya sendiri; tidak bisa mengubah peran', async () => {
    editor = createClient<Database>(SUPABASE_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await editor.auth.signInWithPassword({ email: EDITOR_EMAIL, password: EDITOR_PASSWORD });
    expect(error).toBeNull();

    const visible = await editor.from('admin_profiles').select('id');
    expect((visible.data ?? []).map((row) => row.id)).toEqual([editorId]);

    const self = await editor.from('admin_profiles').update({ role: 'super_admin' }).eq('id', editorId).select();
    expect(self.data ?? []).toHaveLength(0);
    expect((await profile(editorId))!.role).toBe('editor');
    // Editor tidak bisa menaikkan hak orang lain pula.
    const other = await editor.from('admin_profiles').update({ role: 'editor' }).eq('id', adminId).select();
    expect(other.data ?? []).toHaveLength(0);
  });

  it('Editor tidak bisa menghapus lead (hanya Super Admin), tetapi bisa membacanya', async () => {
    const { data, error } = await service
      .from('leads')
      .insert({
        type: 'academy',
        full_name: 'UJI-INT Lead',
        whatsapp_number: '6281200000000',
        city: 'Bandung',
        consent: true,
        ip_hash: '0'.repeat(64),
      })
      .select('id')
      .single();
    if (error) throw error;
    testLeadId = data.id;

    const read = await editor.from('leads').select('id').eq('id', testLeadId);
    expect(read.data ?? []).toHaveLength(1);
    const del = await editor.from('leads').delete().eq('id', testLeadId).select();
    expect(del.data ?? []).toHaveLength(0);
    expect((await service.from('leads').select('id').eq('id', testLeadId)).data).toHaveLength(1);

    // Super Admin boleh.
    const adminDel = await admin.from('leads').delete().eq('id', testLeadId).select();
    expect(adminDel.data ?? []).toHaveLength(1);
    testLeadId = '';
  });

  it('Super Admin satu-satunya tidak bisa diturunkan atau dinonaktifkan (CONFLICT, data tidak berubah)', async () => {
    const before = await listAdminUsers(admin);
    // Pengaman: bila ada Super Admin aktif lain, tes ini akan benar-benar mengubah akun asli.
    if (activeSuperAdmins(before) !== 1) return;
    for (const patch of [{ is_active: false }, { role: 'editor' as const }]) {
      const result = await patchAdminUser(service, adminId, userPatchSchema.parse(patch));
      expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
      if (!result.ok) expect(result.message).toContain('minimal satu Super Admin aktif');
    }
    const after = await profile(adminId);
    expect(after).toMatchObject({ role: 'super_admin', is_active: true });
  });

  it('naikkan Editor jadi Super Admin, lalu turunkan lagi; id tak dikenal → NOT_FOUND', async () => {
    const up = await patchAdminUser(service, editorId, { role: 'super_admin' });
    expect(up).toMatchObject({ ok: true, data: { role: 'super_admin' } });
    // Dengan dua Super Admin aktif, akun uji boleh diturunkan atau dinonaktifkan.
    const down = await patchAdminUser(service, editorId, { role: 'editor' });
    expect(down).toMatchObject({ ok: true, data: { role: 'editor' } });
    expect(
      await patchAdminUser(service, '00000000-0000-4000-8000-000000000000', { is_active: false }),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('nonaktifkan: Editor langsung kehilangan akses data admin (RLS); aktifkan kembali memulihkan', async () => {
    const seen = await editor.from('leads').select('id', { count: 'exact', head: true });
    expect(seen.error).toBeNull();
    // Lead ada selama Editor aktif.
    const { data: lead, error } = await service
      .from('leads')
      .insert({
        type: 'partnership',
        full_name: 'UJI-INT Lead 2',
        whatsapp_number: '6281200000001',
        city: 'Bandung',
        consent: true,
        ip_hash: '0'.repeat(64),
      })
      .select('id')
      .single();
    if (error) throw error;
    testLeadId = lead.id;
    expect((await editor.from('leads').select('id').eq('id', testLeadId)).data).toHaveLength(1);

    expect(await patchAdminUser(service, editorId, { is_active: false })).toMatchObject({
      ok: true,
      data: { is_active: false },
    });
    // Sesi yang sama, request berikutnya: tidak ada akses lagi.
    expect((await editor.from('leads').select('id').eq('id', testLeadId)).data ?? []).toHaveLength(0);
    expect((await editor.from('admin_profiles').select('is_active').eq('id', editorId)).data?.[0]?.is_active).toBe(false);
    // Data publik tetap terbaca (bukan hak admin).
    expect(((await getBuildClient().from('branches').select('id').limit(1)).data ?? []).length).toBe(1);

    expect(await patchAdminUser(service, editorId, { is_active: true })).toMatchObject({ ok: true });
    expect((await editor.from('leads').select('id').eq('id', testLeadId)).data).toHaveLength(1);
  });

  it('anon tidak bisa membaca atau mengubah profil admin', async () => {
    const anon = getBuildClient();
    expect((await anon.from('admin_profiles').select('id')).data ?? []).toHaveLength(0);
    const upd = await anon.from('admin_profiles').update({ role: 'super_admin' }).eq('id', editorId).select();
    expect(upd.data ?? []).toHaveLength(0);
  });
});
