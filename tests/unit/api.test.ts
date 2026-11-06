import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { requireAdmin, requireSuperAdmin } from '@/lib/api/guards';
import { clearAll, hit, isLimited, reset } from '@/lib/api/rate-limit';
import { fail, ok, validationFail, zodToDetails } from '@/lib/api/respond';
import { leadSchema } from '@/lib/validation/lead';
import type { AdminProfile } from '@/types/admin';

const editor: AdminProfile = { id: '1', full_name: 'Editor', email: 'e@x.id', role: 'editor' };
const superAdmin: AdminProfile = { ...editor, id: '2', role: 'super_admin' };

describe('envelope respons', () => {
  it('ok: { success: true, data }', async () => {
    const res = ok({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true, data: { a: 1 } });
  });

  it('fail: status & pesan standar PRD 4.5', async () => {
    const cases = [
      ['VALIDATION_ERROR', 400, 'Data yang dikirim belum valid.'],
      ['UNAUTHORIZED', 401, 'Sesi Anda berakhir, silakan login kembali.'],
      ['FORBIDDEN', 403, 'Anda tidak memiliki akses ke fitur ini.'],
      ['NOT_FOUND', 404, 'Data tidak ditemukan.'],
      ['PAYLOAD_TOO_LARGE', 413, 'Ukuran file maksimal 3 MB.'],
      ['UNSUPPORTED_MEDIA_TYPE', 415, 'Format file harus JPG, PNG, atau WebP.'],
      ['RATE_LIMITED', 429, 'Terlalu banyak percobaan, coba lagi nanti.'],
      ['PUBLISH_FAILED', 502, 'Publikasi gagal, coba lagi.'],
      ['INTERNAL_ERROR', 500, 'Terjadi kesalahan pada server.'],
    ] as const;
    for (const [code, status, message] of cases) {
      const res = fail(code);
      expect(res.status, code).toBe(status);
      expect(await res.json()).toEqual({ success: false, error: { code, message, details: {} } });
    }
  });

  it('fail: pesan khusus dan details', async () => {
    const res = fail('CONFLICT', {
      message: 'Slug sudah dipakai.',
      details: { slug: 'Sudah ada.' },
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: 'CONFLICT', message: 'Slug sudah dipakai.', details: { slug: 'Sudah ada.' } },
    });
  });

  it('zodToDetails: satu pesan pertama per field, path bersarang bertitik', () => {
    const schema = z.object({
      name: z.string().min(2, 'Nama terlalu pendek.').max(3, 'Nama terlalu panjang.'),
      price: z.object({ min: z.number({ error: 'Harus angka.' }) }),
    });
    const parsed = schema.safeParse({ name: 'a', price: { min: 'x' } });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodToDetails(parsed.error)).toEqual({
      name: 'Nama terlalu pendek.',
      'price.min': 'Harus angka.',
    });
  });

  it('validationFail memakai pesan skema lead (Bahasa Indonesia)', async () => {
    const parsed = leadSchema.safeParse({ type: 'academy', full_name: 'A', consent: false });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const res = validationFail(parsed.error);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { details: Record<string, string> } };
    expect(body.error.details.full_name).toBe('Nama minimal 2 karakter.');
    expect(body.error.details.consent).toBe('Centang persetujuan untuk melanjutkan.');
  });
});

describe('guards', () => {
  it('requireAdmin: tanpa sesi 401, dengan sesi mengembalikan profil', async () => {
    const none = requireAdmin({ admin: null });
    expect(none).toBeInstanceOf(Response);
    expect((none as Response).status).toBe(401);
    expect(requireAdmin({ admin: editor })).toBe(editor);
  });

  it('requireSuperAdmin: editor 403, super admin lolos, tanpa sesi 401', () => {
    expect((requireSuperAdmin({ admin: editor }) as Response).status).toBe(403);
    expect(requireSuperAdmin({ admin: superAdmin })).toBe(superAdmin);
    expect((requireSuperAdmin({ admin: null }) as Response).status).toBe(401);
  });
});

describe('rate limit', () => {
  beforeEach(() => clearAll());

  it('mengizinkan sampai batas, lalu membatasi dengan retryAfter', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(hit('ip', 5, 15 * 60_000, t0 + i).limited).toBe(false);
    const sixth = hit('ip', 5, 15 * 60_000, t0 + 10);
    expect(sixth.limited).toBe(true);
    expect(sixth.retryAfter).toBeGreaterThan(0);
    expect(sixth.retryAfter).toBeLessThanOrEqual(900);
  });

  it('slot terbuka lagi setelah jendela lewat', () => {
    const t0 = 5_000;
    for (let i = 0; i < 5; i++) hit('ip', 5, 1000, t0);
    expect(hit('ip', 5, 1000, t0 + 500).limited).toBe(true);
    expect(hit('ip', 5, 1000, t0 + 1001).limited).toBe(false);
  });

  it('kunci berbeda tidak saling memengaruhi; reset membersihkan', () => {
    for (let i = 0; i < 5; i++) hit('a', 5, 60_000);
    expect(hit('a', 5, 60_000).limited).toBe(true);
    expect(hit('b', 5, 60_000).limited).toBe(false);
    reset('a');
    expect(hit('a', 5, 60_000).limited).toBe(false);
  });

  it('isLimited tidak mencatat kejadian', () => {
    for (let i = 0; i < 4; i++) hit('c', 5, 60_000);
    expect(isLimited('c', 5, 60_000).limited).toBe(false);
    expect(isLimited('c', 5, 60_000).limited).toBe(false);
    hit('c', 5, 60_000);
    expect(isLimited('c', 5, 60_000).limited).toBe(true);
  });
});
