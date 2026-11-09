import { describe, expect, it } from 'vitest';
import { countSummary, overLimit, pendingFaqCount, stars, truncate } from '@/lib/admin/content-view';
import {
  checkFaq,
  faqCreateSchema,
  faqPatchSchema,
  isPendingAnswer,
} from '@/lib/validation/admin-faqs';
import { reorderSchema } from '@/lib/validation/admin-order';
import {
  testimonialCreateSchema,
  testimonialPatchSchema,
} from '@/lib/validation/admin-testimonials';

const UUID = '6f1c8e0a-0b1c-4d2e-8f3a-123456789abc';

describe('skema testimoni', () => {
  const ok = { customer_name: 'Rizky A.', rating: 5, content: 'Rapi dan ramah.', source: 'google' };

  it('lengkap → lolos dengan bawaan (aktif, bukan contoh, semua cabang)', () => {
    expect(testimonialCreateSchema.parse(ok)).toMatchObject({
      branch_id: null,
      is_active: true,
      is_placeholder: false,
    });
  });
  it('cabang "" jadi null, UUID dipertahankan, selain itu ditolak', () => {
    expect(testimonialCreateSchema.parse({ ...ok, branch_id: '' }).branch_id).toBeNull();
    expect(testimonialCreateSchema.parse({ ...ok, branch_id: UUID }).branch_id).toBe(UUID);
    expect(testimonialCreateSchema.safeParse({ ...ok, branch_id: 'dago' }).success).toBe(false);
  });
  it('rating 1–5 bulat; teks angka dari select diterima', () => {
    expect(testimonialCreateSchema.parse({ ...ok, rating: '4' }).rating).toBe(4);
    for (const rating of [0, 6, 3.5, '', 'x', null]) {
      expect(testimonialCreateSchema.safeParse({ ...ok, rating }).success).toBe(false);
    }
  });
  it('isi 1–500 karakter, nama 2–60, sumber dari daftar', () => {
    expect(testimonialCreateSchema.safeParse({ ...ok, content: 'x'.repeat(500) }).success).toBe(true);
    const long = testimonialCreateSchema.safeParse({ ...ok, content: 'x'.repeat(501) });
    expect(long.success).toBe(false);
    expect(testimonialCreateSchema.safeParse({ ...ok, content: '  ' }).success).toBe(false);
    expect(testimonialCreateSchema.safeParse({ ...ok, customer_name: 'A' }).success).toBe(false);
    expect(testimonialCreateSchema.safeParse({ ...ok, source: 'tiktok' }).success).toBe(false);
  });
  it('patch: hanya dua saklar', () => {
    expect(testimonialPatchSchema.safeParse({ is_active: false }).success).toBe(true);
    expect(testimonialPatchSchema.safeParse({}).success).toBe(false);
    expect(testimonialPatchSchema.safeParse({ rating: 5 }).success).toBe(false);
    expect(testimonialPatchSchema.safeParse({ sort_order: 1 }).success).toBe(false);
  });
});

describe('skema FAQ', () => {
  const ok = { question: 'Jam buka Golden Barber?', answer: 'Setiap hari 08.00–23.00 WIB.' };

  it('lengkap → lolos, bawaan aktif', () => {
    expect(faqCreateSchema.parse(ok).is_active).toBe(true);
  });
  it('jawaban penanda "MENUNGGU KONFIRMASI PEMILIK" tidak boleh aktif; boleh nonaktif', () => {
    const pending = { ...ok, answer: 'MENUNGGU KONFIRMASI PEMILIK' };
    expect(faqCreateSchema.safeParse(pending).success).toBe(false);
    expect(faqCreateSchema.safeParse({ ...pending, is_active: false }).success).toBe(true);
    const bad = faqCreateSchema.safeParse({ ...ok, answer: 'menunggu konfirmasi pemilik.' });
    expect(bad.success).toBe(false);
  });
  it('jawaban kosong ditolak; pertanyaan 5–200, jawaban ≤ 1000', () => {
    expect(faqCreateSchema.safeParse({ ...ok, answer: '  ' }).success).toBe(false);
    expect(faqCreateSchema.safeParse({ ...ok, question: 'Apa?' }).success).toBe(false);
    expect(faqCreateSchema.safeParse({ ...ok, question: 'x'.repeat(201) }).success).toBe(false);
    expect(faqCreateSchema.safeParse({ ...ok, answer: 'x'.repeat(1001) }).success).toBe(false);
  });
  it('isPendingAnswer / checkFaq', () => {
    expect(isPendingAnswer('')).toBe(true);
    expect(isPendingAnswer('  Menunggu konfirmasi pemilik ')).toBe(true);
    expect(isPendingAnswer('Buka setiap hari.')).toBe(false);
    expect(checkFaq({ is_active: true, answer: '' })).toHaveProperty('answer');
    expect(checkFaq({ is_active: false, answer: '' })).toEqual({});
  });
  it('patch: hanya saklar tampil', () => {
    expect(faqPatchSchema.safeParse({ is_active: true }).success).toBe(true);
    expect(faqPatchSchema.safeParse({ answer: 'x' }).success).toBe(false);
    expect(faqPatchSchema.safeParse({}).success).toBe(false);
  });
});

describe('skema urut ulang bersama', () => {
  it('menerima daftar sah, menolak dobel/kosong/ID rusak', () => {
    const id2 = '7f1c8e0a-0b1c-4d2e-8f3a-123456789abc';
    expect(reorderSchema.safeParse([{ id: UUID, sort_order: 1 }, { id: id2, sort_order: 2 }]).success).toBe(true);
    expect(reorderSchema.safeParse([{ id: UUID, sort_order: 1 }, { id: UUID, sort_order: 2 }]).success).toBe(false);
    expect(reorderSchema.safeParse([]).success).toBe(false);
    expect(reorderSchema.safeParse([{ id: 'x', sort_order: 1 }]).success).toBe(false);
  });
});

describe('content-view', () => {
  it('stars', () => {
    expect(stars(5)).toBe('★★★★★');
    expect(stars(3)).toBe('★★★☆☆');
    expect(stars(9)).toBe('★★★★★');
    expect(stars(-1)).toBe('☆☆☆☆☆');
  });
  it('truncate memadatkan spasi dan memotong dengan …', () => {
    expect(truncate('  a   b\n c ', 20)).toBe('a b c');
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
  it('countSummary / overLimit / pendingFaqCount', () => {
    expect(countSummary('FAQ', [])).toBe('Belum ada FAQ.');
    expect(countSummary('testimoni', [{ is_active: true }, { is_active: false }])).toBe(
      '2 testimoni · 1 aktif',
    );
    expect(overLimit(Array.from({ length: 12 }, () => ({ is_active: true })), 10)).toBe(2);
    expect(overLimit([{ is_active: false }], 10)).toBe(0);
    expect(
      pendingFaqCount([{ answer: 'MENUNGGU KONFIRMASI PEMILIK' }, { answer: '' }, { answer: 'ok' }]),
    ).toBe(2);
  });
});
