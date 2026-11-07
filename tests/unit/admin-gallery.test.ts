import { describe, expect, it } from 'vitest';
import { gallerySummary, hiddenByLimit, titleFromFilename } from '@/lib/admin/gallery';
import {
  UPLOAD_MAX_BYTES,
  checkUploadFile,
  formatBytes,
  isSitePath,
  isStoragePath,
  mediaUrl,
} from '@/lib/media';
import {
  checkGallery,
  galleryCreateSchema,
  galleryPatchSchema,
  galleryReorderSchema,
  uploadRequestSchema,
} from '@/lib/validation/admin-gallery';

const UUID = '6f1c8e0a-0b1c-4d2e-8f3a-123456789abc';
const BASE = 'https://abc.supabase.co';

describe('mediaUrl', () => {
  it('path bucket → URL publik Supabase', () => {
    expect(mediaUrl(`gallery/${UUID}.webp`, BASE)).toBe(
      `${BASE}/storage/v1/object/public/media/gallery/${UUID}.webp`,
    );
    expect(mediaUrl(`gallery/${UUID}.webp`, `${BASE}/`)).toBe(
      `${BASE}/storage/v1/object/public/media/gallery/${UUID}.webp`,
    );
  });
  it('aset situs dan URL penuh dibiarkan', () => {
    expect(mediaUrl('/images/dummy/galeri-1.webp', BASE)).toBe('/images/dummy/galeri-1.webp');
    expect(mediaUrl('https://cdn.example/x.png', BASE)).toBe('https://cdn.example/x.png');
  });
  it('tanpa URL Supabase → path apa adanya (tidak melempar)', () => {
    expect(mediaUrl(`gallery/${UUID}.webp`, '')).toBe(`gallery/${UUID}.webp`);
  });
});

describe('isStoragePath / isSitePath', () => {
  it('hanya folder yang dikenal, UUID penuh, ekstensi gambar', () => {
    for (const ok of [`gallery/${UUID}.jpg`, `branches/${UUID}.png`, `site/${UUID}.webp`]) {
      expect(isStoragePath(ok)).toBe(true);
    }
    for (const bad of [
      `other/${UUID}.jpg`,
      `gallery/${UUID}.gif`,
      `gallery/${UUID}.svg`,
      'gallery/abc.png',
      `gallery/../${UUID}.png`,
      `/gallery/${UUID}.png`,
      `gallery/${UUID}.png/extra`,
    ]) {
      expect(isStoragePath(bad)).toBe(false);
    }
  });
  it('path situs: /images/... tanpa ..', () => {
    expect(isSitePath('/images/dummy/galeri-1.webp')).toBe(true);
    expect(isSitePath('/images/../secret.png')).toBe(false);
    expect(isSitePath('images/x.png')).toBe(false);
    expect(isSitePath('//evil.example/x.png')).toBe(false);
  });
});

describe('checkUploadFile', () => {
  const file = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
    name: 'a.png',
    type: 'image/png',
    size: 1000,
    ...over,
  });
  it('lolos: JPG, PNG, WebP sampai tepat 3 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkUploadFile(file({ type }))).toBeNull();
    }
    expect(checkUploadFile(file({ size: UPLOAD_MAX_BYTES }))).toBeNull();
  });
  it('> 3 MB → pesan memuat ukuran', () => {
    expect(checkUploadFile(file({ size: 4.2 * 1024 * 1024 }))).toBe(
      'File terlalu besar (4,2 MB). Maksimal 3 MB — kompres atau simpan sebagai WebP.',
    );
  });
  it('format lain dan file kosong ditolak', () => {
    for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', '']) {
      expect(checkUploadFile(file({ type }))).toBe('Format file harus JPG, PNG, atau WebP.');
    }
    expect(checkUploadFile(file({ size: 0 }))).toBe('File kosong.');
  });
  it('formatBytes', () => {
    expect(formatBytes(1.8 * 1024 * 1024)).toBe('1,8 MB');
    expect(formatBytes(320 * 1024)).toBe('320 KB');
    expect(formatBytes(10)).toBe('1 KB');
  });
});

describe('titleFromFilename', () => {
  it('rapikan nama berkas jadi judul', () => {
    expect(titleFromFilename('low-fade_pompadour.webp')).toBe('Low fade pompadour');
    expect(titleFromFilename('IMG__001.JPG')).toBe('IMG 001');
  });
  it('terlalu pendek → judul bawaan; terlalu panjang dipotong 80', () => {
    expect(titleFromFilename('a.png')).toBe('Gaya baru');
    expect(titleFromFilename(`${'x'.repeat(120)}.png`).length).toBeLessThanOrEqual(80);
  });
});

describe('ringkasan', () => {
  it('gallerySummary', () => {
    expect(gallerySummary([])).toBe('Belum ada gambar.');
    expect(gallerySummary([{ is_active: true }, { is_active: false }, { is_active: true }])).toBe(
      '3 gambar · 2 aktif',
    );
  });
  it('hiddenByLimit hanya menghitung yang aktif di atas batas', () => {
    const items = Array.from({ length: 14 }, (_, i) => ({ is_active: i < 13 }));
    expect(hiddenByLimit(items, 12)).toBe(1);
    expect(hiddenByLimit(items.slice(0, 5), 12)).toBe(0);
  });
});

describe('skema galeri', () => {
  const base = { title: 'French Crop', image_path: `gallery/${UUID}.webp`, alt_text: 'Model French Crop' };

  it('lengkap → lolos, deskripsi kosong jadi null, bawaan aktif & bukan ilustrasi', () => {
    const parsed = galleryCreateSchema.parse({ ...base, description: '  ' });
    expect(parsed).toMatchObject({ description: null, is_active: true, is_placeholder: false });
  });
  it('alt text wajib bila aktif; boleh kosong bila nonaktif', () => {
    expect(galleryCreateSchema.safeParse({ ...base, alt_text: ' ' }).success).toBe(false);
    expect(
      galleryCreateSchema.safeParse({ ...base, alt_text: '', is_active: false }).success,
    ).toBe(true);
    expect(checkGallery({ is_active: true, alt_text: '' })).toHaveProperty('alt_text');
    expect(checkGallery({ is_active: false, alt_text: '' })).toEqual({});
  });
  it('judul 2–80, deskripsi ≤ 300, alt ≤ 200', () => {
    expect(galleryCreateSchema.safeParse({ ...base, title: 'A' }).success).toBe(false);
    expect(galleryCreateSchema.safeParse({ ...base, title: 'x'.repeat(81) }).success).toBe(false);
    expect(galleryCreateSchema.safeParse({ ...base, description: 'x'.repeat(301) }).success).toBe(false);
    expect(galleryCreateSchema.safeParse({ ...base, alt_text: 'x'.repeat(201) }).success).toBe(false);
  });
  it('path gambar: bucket atau aset situs; selain itu ditolak', () => {
    expect(galleryCreateSchema.safeParse({ ...base, image_path: '/images/dummy/galeri-1.webp' }).success).toBe(true);
    for (const image_path of [
      'https://evil.example/x.png',
      'javascript:alert(1)',
      `gallery/../${UUID}.png`,
      '',
    ]) {
      expect(galleryCreateSchema.safeParse({ ...base, image_path }).success).toBe(false);
    }
    expect(galleryCreateSchema.safeParse({ title: 'Tanpa gambar' }).success).toBe(false);
  });
  it('patch: sebagian field; kosong dan field asing ditolak', () => {
    expect(galleryPatchSchema.safeParse({ is_active: true }).success).toBe(true);
    expect(galleryPatchSchema.parse({ description: '' })).toEqual({ description: null });
    expect(galleryPatchSchema.safeParse({}).success).toBe(false);
    expect(galleryPatchSchema.safeParse({ image_path: `gallery/${UUID}.png` }).success).toBe(false);
    expect(galleryPatchSchema.safeParse({ sort_order: 3 }).success).toBe(false);
  });
  it('reorder: ID valid dan tidak dobel', () => {
    const id2 = '7f1c8e0a-0b1c-4d2e-8f3a-123456789abc';
    expect(galleryReorderSchema.safeParse([{ id: UUID, sort_order: 1 }, { id: id2, sort_order: 2 }]).success).toBe(true);
    expect(galleryReorderSchema.safeParse([{ id: UUID, sort_order: 1 }, { id: UUID, sort_order: 2 }]).success).toBe(false);
    expect(galleryReorderSchema.safeParse([]).success).toBe(false);
    expect(galleryReorderSchema.safeParse([{ id: 'x', sort_order: 1 }]).success).toBe(false);
  });
});

describe('skema unggahan', () => {
  it('menerima permintaan sah', () => {
    expect(
      uploadRequestSchema.safeParse({ folder: 'gallery', content_type: 'image/webp', size: 1000 }).success,
    ).toBe(true);
  });
  it('menolak folder, tipe, dan ukuran di luar aturan', () => {
    const ok = { folder: 'gallery', content_type: 'image/png', size: 1000 };
    expect(uploadRequestSchema.safeParse({ ...ok, folder: '../x' }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...ok, content_type: 'image/gif' }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...ok, size: UPLOAD_MAX_BYTES + 1 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...ok, size: 0 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...ok, size: 1.5 }).success).toBe(false);
  });
});
