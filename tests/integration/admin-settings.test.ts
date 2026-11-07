// Pengaturan situs (PRD F-21) terhadap Supabase sungguhan dengan sesi admin nyata + RLS anon.
// Tes ini MENULIS ke `site_settings` asli, jadi semua nilai asli dibaca dulu dan dipulihkan persis di
// akhir (afterAll), termasuk berkas hero uji di bucket. Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listSettings, putSetting } from '@/lib/admin/settings-db';
import { requestSignedUpload } from '@/lib/admin/uploads';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import { EDITABLE_KEYS } from '@/lib/validation/admin-settings';
import type { Database, Json } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;

const service = getServiceClient();
let admin: SupabaseClient<Database>;
let adminId = '';
let original: Record<string, unknown> = {};
const uploaded: string[] = [];

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function uploadSitePng(): Promise<string> {
  const signed = await requestSignedUpload(service, SUPABASE_URL, {
    folder: 'site',
    content_type: 'image/png',
    size: PNG.length,
  });
  if (!signed.ok) throw new Error(`URL unggah gagal: ${signed.code}`);
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', new Blob([PNG], { type: 'image/png' }));
  const response = await fetch(signed.data.upload_url, { method: 'PUT', body });
  expect(response.status).toBeLessThan(300);
  uploaded.push(signed.data.path);
  return signed.data.path;
}

const inBucket = async (path: string) => {
  const [folder, file] = path.split('/');
  const { data, error } = await service.storage.from('media').list(folder, { search: file });
  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === file);
};

const stored = async (key: string) => {
  const { data, error } = await service.from('site_settings').select('*').eq('key', key).single();
  if (error) throw error;
  return data;
};

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.signInWithPassword({ email: email!, password: password! });
  if (error) throw error;
  adminId = data.user.id;
  const { data: rows, error: listError } = await service
    .from('site_settings')
    .select('key, value, updated_by');
  if (listError) throw listError;
  original = Object.fromEntries((rows ?? []).map((row) => [row.key, row]));
});

afterAll(async () => {
  if (!enabled) return;
  // Pulihkan nilai (dan penulis terakhir) persis seperti sebelum tes.
  for (const [key, row] of Object.entries(original) as [string, { value: Json; updated_by: string | null }][]) {
    await service.from('site_settings').update({ value: row.value, updated_by: row.updated_by }).eq('key', key);
  }
  if (uploaded.length > 0) await service.storage.from('media').remove(uploaded);
});

describe.skipIf(!enabled)('pengaturan situs (sesi admin sungguhan)', () => {
  it('GET: semua 11 kunci terbaca, termasuk yang tidak bisa diubah', async () => {
    const all = await listSettings(admin);
    for (const key of [...EDITABLE_KEYS, 'media_mentions', 'seo_defaults']) {
      expect(all, key).toHaveProperty(key);
    }
  });

  it('PUT social_links: tersimpan, dicatat updated_by; nilai lain tidak berubah', async () => {
    const current = (original.social_links as { value: Record<string, string> }).value;
    const result = await putSetting(admin, service, adminId, 'social_links', {
      ...current,
      linktree: 'https://linktr.ee/uji-integrasi',
    });
    expect(result).toMatchObject({ ok: true, data: { key: 'social_links' } });
    const row = await stored('social_links');
    expect((row.value as Record<string, string>).linktree).toBe('https://linktr.ee/uji-integrasi');
    expect((row.value as Record<string, string>).instagram).toBe(current.instagram);
    expect(row.updated_by).toBe(adminId);
  });

  it('PUT whatsapp_number: ditulis dengan format apa pun, disimpan ternormalisasi', async () => {
    const result = await putSetting(admin, service, adminId, 'whatsapp_number', '0812-1480-7192');
    expect(result).toMatchObject({ ok: true, data: { value: '6281214807192' } });
    expect((await stored('whatsapp_number')).value).toBe('6281214807192');
  });

  it('nilai tidak valid ditolak dengan detail per kolom dan TIDAK mengubah data', async () => {
    const before = await stored('whatsapp_templates');
    const templates = { ...(before.value as Record<string, string>), general: 'Halo {nama_cabang}' };
    const result = await putSetting(admin, service, adminId, 'whatsapp_templates', templates);
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    if (!result.ok) expect(result.details).toHaveProperty('general');
    expect((await stored('whatsapp_templates')).value).toEqual(before.value);

    for (const [key, value] of [
      ['whatsapp_number', '123'],
      ['social_links', { instagram: 'javascript:alert(1)', threads: 'x', linktree: '', academy_instagram: 'x' }],
      ['google_rating', { rating: 9, review_count: 1, scope: 'x', updated_at: '2026-01-01' }],
      ['hero', null],
      ['haircut_includes', []],
      ['about_highlights', 'bukan array'],
    ] as const) {
      expect(await putSetting(admin, service, adminId, key, value), key).toMatchObject({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
    }
  });

  it('kunci tak dikenal dan kunci yang tidak boleh diubah → NOT_FOUND', async () => {
    for (const key of ['seo_defaults', 'media_mentions', 'bukan_kunci', '']) {
      expect(await putSetting(admin, service, adminId, key, {}), key).toMatchObject({
        ok: false,
        code: 'NOT_FOUND',
      });
    }
  });

  it('PUT bagian teks dan rating: tersimpan lalu terbaca sama persis', async () => {
    const rating = { rating: 4.8, review_count: 3341, scope: 'Cabang Dago', updated_at: '2026-11-08' };
    expect(await putSetting(admin, service, adminId, 'google_rating', rating)).toMatchObject({ ok: true });
    expect((await stored('google_rating')).value).toEqual(rating);

    const academy = { title: 'Golden Academy Uji', description: 'Deskripsi uji yang cukup panjang untuk lolos validasi.', is_details_available: false };
    expect(await putSetting(admin, service, adminId, 'academy_section', academy)).toMatchObject({ ok: true });
    expect((await stored('academy_section')).value).toEqual(academy);
  });

  it('ganti gambar hero: berkas lama di bucket dihapus; dummy bawaan tidak disentuh', async () => {
    const hero = (original.hero as { value: Record<string, unknown> }).value;
    const pathA = await uploadSitePng();
    expect(
      await putSetting(admin, service, adminId, 'hero', { ...hero, image_path: pathA, image_is_placeholder: false }),
    ).toMatchObject({ ok: true });
    expect(await inBucket(pathA)).toBe(true);

    const pathB = await uploadSitePng();
    expect(
      await putSetting(admin, service, adminId, 'hero', { ...hero, image_path: pathB, image_is_placeholder: false }),
    ).toMatchObject({ ok: true });
    expect(await inBucket(pathA)).toBe(false);
    expect(await inBucket(pathB)).toBe(true);

    // Kembali ke ilustrasi bawaan: berkas unggahan terakhir ikut dihapus.
    expect(await putSetting(admin, service, adminId, 'hero', hero)).toMatchObject({ ok: true });
    expect(await inBucket(pathB)).toBe(false);
    expect((await stored('hero')).value).toEqual(hero);
  });

  it('anon tidak bisa mengubah pengaturan (RLS)', async () => {
    const before = await stored('whatsapp_number');
    const result = await getBuildClient()
      .from('site_settings')
      .update({ value: '6280000000000' })
      .eq('key', 'whatsapp_number')
      .select();
    expect(result.data ?? []).toHaveLength(0);
    expect((await stored('whatsapp_number')).value).toBe(before.value);
  });
});
