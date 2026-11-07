// Galeri + unggahan (PRD F-21) terhadap Supabase sungguhan dengan sesi admin nyata: URL unggah
// bertanda tangan, berkas di bucket `media`, hapus berkas saat item dihapus/gambar diganti, RLS.
// Item uji NONAKTIF (tidak tampil di situs). Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createGalleryItem,
  deleteGalleryItem,
  listGallery,
  patchGalleryItem,
  reorderGallery,
  updateGalleryItem,
} from '@/lib/admin/gallery-db';
import { requestSignedUpload } from '@/lib/admin/uploads';
import { UPLOAD_MAX_BYTES } from '@/lib/media';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import {
  galleryCreateSchema,
  galleryPatchSchema,
  type GalleryCreate,
} from '@/lib/validation/admin-gallery';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;

const service = getServiceClient();
const RUN = Date.now().toString(36);
const PREFIX = 'UJI-INT Galeri';

let admin: SupabaseClient<Database>;
const uploaded: string[] = [];

// PNG 1×1 valid.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Seluruh alur browser: minta URL → PUT berkas → path siap disimpan. */
async function uploadPng(): Promise<string> {
  const signed = await requestSignedUpload(service, SUPABASE_URL, {
    folder: 'gallery',
    content_type: 'image/png',
    size: PNG.length,
  });
  if (!signed.ok) throw new Error(`minta URL unggah gagal: ${signed.code}`);
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', new Blob([PNG], { type: 'image/png' }));
  const response = await fetch(signed.data.upload_url, { method: 'PUT', body });
  expect(response.status, await response.clone().text()).toBeLessThan(300);
  uploaded.push(signed.data.path);
  return signed.data.path;
}

const publicStatus = async (path: string) =>
  (await fetch(`${SUPABASE_URL}/storage/v1/object/public/media/${path}`)).status;

/** Ada di bucket? Lewat API storage (URL publik bisa tertahan di cache CDN setelah dihapus). */
const inBucket = async (path: string) => {
  const [folder, file] = path.split('/');
  const { data, error } = await service.storage.from('media').list(folder, { search: file });
  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === file);
};

const make = (over: Record<string, unknown> & { image_path: string }) =>
  createGalleryItem(
    admin,
    galleryCreateSchema.parse({
      title: `${PREFIX} ${RUN}`,
      alt_text: 'Contoh uji',
      is_active: false,
      is_placeholder: true,
      ...over,
    }) as GalleryCreate,
  );

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.signInWithPassword({ email: email!, password: password! });
  if (error) throw error;
});

afterAll(async () => {
  if (!enabled) return;
  await service.from('gallery_items').delete().like('title', `${PREFIX}%`);
  if (uploaded.length > 0) await service.storage.from('media').remove(uploaded);
});

describe.skipIf(!enabled)('unggahan bertanda tangan', () => {
  it('tipe selain JPG/PNG/WebP → UNSUPPORTED_MEDIA_TYPE, tanpa membuat URL', async () => {
    for (const type of ['image/gif', 'application/pdf', 'image/svg+xml', undefined]) {
      const result = await requestSignedUpload(service, SUPABASE_URL, {
        folder: 'gallery',
        content_type: type,
        size: 1000,
      });
      expect(result).toMatchObject({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
    }
  });

  it('> 3 MB → PAYLOAD_TOO_LARGE; tepat 3 MB boleh', async () => {
    const big = await requestSignedUpload(service, SUPABASE_URL, {
      folder: 'gallery',
      content_type: 'image/webp',
      size: UPLOAD_MAX_BYTES + 1,
    });
    expect(big).toMatchObject({ ok: false, code: 'PAYLOAD_TOO_LARGE' });
    const edge = await requestSignedUpload(service, SUPABASE_URL, {
      folder: 'gallery',
      content_type: 'image/webp',
      size: UPLOAD_MAX_BYTES,
    });
    expect(edge.ok).toBe(true);
  });

  it('folder liar atau ukuran rusak → VALIDATION_ERROR', async () => {
    const folder = await requestSignedUpload(service, SUPABASE_URL, {
      folder: '../etc',
      content_type: 'image/png',
      size: 10,
    });
    expect(folder).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    for (const size of [0, -5, 1.5, '10', undefined]) {
      const result = await requestSignedUpload(service, SUPABASE_URL, {
        folder: 'gallery',
        content_type: 'image/png',
        size,
      });
      expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    }
  });

  it('PUT berkas ke URL bertanda tangan → terbaca lewat URL publik', async () => {
    const path = await uploadPng();
    expect(path).toMatch(/^gallery\/[0-9a-f-]{36}\.png$/);
    expect(await publicStatus(path)).toBe(200);
  });

  it('bucket menolak tipe di luar daftar walau URL sudah dipegang', async () => {
    const signed = await requestSignedUpload(service, SUPABASE_URL, {
      folder: 'gallery',
      content_type: 'image/png',
      size: 10,
    });
    if (!signed.ok) throw new Error('URL tidak dibuat');
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', new Blob(['<html></html>'], { type: 'text/html' }));
    const response = await fetch(signed.data.upload_url, { method: 'PUT', body });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe.skipIf(!enabled)('galeri admin (sesi admin sungguhan)', () => {
  let item1 = '';
  let item2 = '';
  let path1 = '';
  let path2 = '';

  it('buat item: di akhir urutan, berkas ada; anon tidak bisa menulis', async () => {
    const before = await listGallery(admin);
    path1 = await uploadPng();
    const result = await make({ image_path: path1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    item1 = result.data.id;
    expect(result.data.sort_order).toBe(Math.max(...before.map((row) => row.sort_order)) + 1);
    expect(result.data.image_path).toBe(path1);

    const anon = await getBuildClient().from('gallery_items').insert({
      title: `${PREFIX} anon`,
      image_path: path1,
      alt_text: 'x',
    });
    expect(anon.error).not.toBeNull();
  });

  it('skema: alt text wajib bila aktif; path liar ditolak', () => {
    const base = { title: 'Gaya uji', image_path: 'gallery/6f1c8e0a-0b1c-4d2e-8f3a-123456789abc.webp' };
    expect(galleryCreateSchema.safeParse({ ...base, is_active: true, alt_text: '  ' }).success).toBe(false);
    expect(galleryCreateSchema.safeParse({ ...base, is_active: false, alt_text: '' }).success).toBe(true);
    for (const image_path of ['http://evil.example/x.png', 'gallery/../../x.png', 'gallery/abc.png', '']) {
      expect(galleryCreateSchema.safeParse({ ...base, image_path, alt_text: 'a' }).success).toBe(false);
    }
  });

  it('patch: tidak bisa mengaktifkan tanpa alt text; bisa setelah alt diisi', async () => {
    const blank = await make({ image_path: await uploadPng(), alt_text: '' });
    expect(blank.ok).toBe(true);
    if (!blank.ok) return;
    item2 = blank.data.id;
    path2 = blank.data.image_path;
    const denied = await patchGalleryItem(admin, item2, galleryPatchSchema.parse({ is_active: true }));
    expect(denied).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    if (!denied.ok) expect(denied.details).toHaveProperty('alt_text');

    const both = galleryPatchSchema.parse({ is_active: true, alt_text: 'Model uji' });
    // Dua perubahan sekaligus lolos; langsung dinonaktifkan lagi supaya tidak tampil di situs.
    expect(await patchGalleryItem(admin, item2, both)).toMatchObject({ ok: true });
    expect(
      await patchGalleryItem(admin, item2, galleryPatchSchema.parse({ is_active: false })),
    ).toMatchObject({ ok: true });
  });

  it('patch menolak field asing', () => {
    expect(galleryPatchSchema.safeParse({ sort_order: 1 }).success).toBe(false);
    expect(galleryPatchSchema.safeParse({}).success).toBe(false);
  });

  it('urut ulang: tukar dua item uji, lalu pulihkan; daftar tidak lengkap → CONFLICT', async () => {
    const rows = await listGallery(admin);
    const a = rows.find((row) => row.id === item1)!;
    const b = rows.find((row) => row.id === item2)!;
    const swapped = rows.map((row) =>
      row.id === a.id ? { id: row.id, sort_order: b.sort_order } : row.id === b.id ? { id: row.id, sort_order: a.sort_order } : { id: row.id, sort_order: row.sort_order },
    );
    expect(await reorderGallery(admin, swapped)).toMatchObject({ ok: true });
    const after = await listGallery(admin);
    expect(after.find((row) => row.id === a.id)!.sort_order).toBe(b.sort_order);

    expect(await reorderGallery(admin, swapped.slice(1))).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
    expect(
      await reorderGallery(admin, [{ id: '00000000-0000-4000-8000-000000000000', sort_order: 1 }]),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('ganti gambar: berkas lama terhapus dari storage, berkas baru ada', async () => {
    const replacement = await uploadPng();
    const row = (await listGallery(admin)).find((r) => r.id === item1)!;
    const result = await updateGalleryItem(
      admin,
      service,
      item1,
      galleryCreateSchema.parse({
        title: row.title,
        description: row.description,
        alt_text: row.alt_text,
        is_placeholder: row.is_placeholder,
        is_active: false,
        image_path: replacement,
      }),
    );
    expect(result.ok).toBe(true);
    expect(await inBucket(path1)).toBe(false);
    expect(await inBucket(replacement)).toBe(true);
    path1 = replacement;
  });

  it('hapus item: baris hilang dan berkas di storage ikut terhapus', async () => {
    expect(await inBucket(path2)).toBe(true);
    expect(await deleteGalleryItem(admin, service, item2)).toMatchObject({ ok: true });
    expect(await inBucket(path2)).toBe(false);
    expect((await listGallery(admin)).some((row) => row.id === item2)).toBe(false);
    expect(await deleteGalleryItem(admin, service, item2)).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('hapus item berfoto dummy tidak menyentuh storage (tanpa galat)', async () => {
    const made = await make({ image_path: '/images/dummy/galeri-1.webp' });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(await deleteGalleryItem(admin, service, made.data.id)).toMatchObject({ ok: true });
  });

  it('data publik: item uji nonaktif tidak terbaca anon; yang asli utuh', async () => {
    const { data } = await getBuildClient().from('gallery_items').select('title');
    expect((data ?? []).some((row) => row.title.startsWith(PREFIX))).toBe(false);
    expect((data ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
