// Testimoni dan FAQ admin (PRD F-21) terhadap Supabase sungguhan dengan sesi admin nyata + RLS anon.
// Baris uji NONAKTIF (tidak tampil di situs) dan bernama unik; baris asli tidak diubah.
// Butuh E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD di .env; dilewati bila kosong.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFaq,
  deleteFaq,
  listFaqs,
  patchFaq,
  reorderFaqs,
  updateFaq,
} from '@/lib/admin/faqs-db';
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  patchTestimonial,
  reorderTestimonials,
  updateTestimonial,
} from '@/lib/admin/testimonials-db';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import { faqCreateSchema, faqPatchSchema } from '@/lib/validation/admin-faqs';
import {
  testimonialCreateSchema,
  testimonialPatchSchema,
} from '@/lib/validation/admin-testimonials';
import type { Database } from '@/types/database';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const enabled = Boolean(email && password);

const service = getServiceClient();
const RUN = Date.now().toString(36);
const T_PREFIX = `UJI-INT Testimoni ${RUN}`;
const F_PREFIX = `UJI-INT FAQ ${RUN}?`;

let admin: SupabaseClient<Database>;
let branchId = '';

const tst = (over: Record<string, unknown> = {}) =>
  testimonialCreateSchema.parse({
    customer_name: `${T_PREFIX}`,
    rating: 4,
    content: 'Isi uji integrasi.',
    source: 'langsung',
    is_placeholder: true,
    is_active: false,
    ...over,
  });

const faq = (over: Record<string, unknown> = {}) =>
  faqCreateSchema.parse({
    question: `${F_PREFIX} ${over.n ?? ''}`.trim(),
    answer: 'Jawaban uji integrasi.',
    is_active: false,
    ...over,
  });

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient<Database>(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.auth.signInWithPassword({ email: email!, password: password! });
  if (error) throw error;
  const { data } = await service.from('branches').select('id').limit(1).single();
  branchId = data!.id;
});

afterAll(async () => {
  if (!enabled) return;
  await service.from('testimonials').delete().like('customer_name', `${T_PREFIX}%`);
  await service.from('faqs').delete().like('question', `${F_PREFIX}%`);
});

describe.skipIf(!enabled)('testimoni admin (sesi admin sungguhan)', () => {
  let t1 = '';
  let t2 = '';

  it('buat: di akhir urutan, cabang opsional; anon tidak bisa menulis', async () => {
    const before = await listTestimonials(admin);
    const a = await createTestimonial(admin, tst({ customer_name: `${T_PREFIX} A`, branch_id: branchId }));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    t1 = a.data.id;
    expect(a.data.branch_id).toBe(branchId);
    expect(a.data.sort_order).toBe(Math.max(...before.map((row) => row.sort_order)) + 1);

    const b = await createTestimonial(admin, tst({ customer_name: `${T_PREFIX} B` }));
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    t2 = b.data.id;
    expect(b.data.branch_id).toBeNull();

    const anon = await getBuildClient()
      .from('testimonials')
      .insert({ customer_name: 'x', rating: 5, content: 'x', source: 'google' });
    expect(anon.error).not.toBeNull();
  });

  it('cabang tidak ada → VALIDATION_ERROR, bukan 500', async () => {
    const result = await createTestimonial(
      admin,
      tst({ branch_id: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('ubah penuh (PUT) dan saklar (PATCH)', async () => {
    const updated = await updateTestimonial(
      admin,
      t1,
      tst({ customer_name: `${T_PREFIX} A2`, rating: 2, source: 'google', branch_id: '' }),
    );
    expect(updated).toMatchObject({ ok: true, data: { rating: 2, source: 'google', branch_id: null } });

    const patched = await patchTestimonial(admin, t1, testimonialPatchSchema.parse({ is_placeholder: false }));
    expect(patched).toMatchObject({ ok: true, data: { is_placeholder: false, is_active: false } });
    expect(await patchTestimonial(admin, '00000000-0000-4000-8000-000000000000', { is_active: false })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('DB menolak rating/isi di luar batas (constraint) walau skema dilewati', async () => {
    const bad = await service
      .from('testimonials')
      .insert({ customer_name: `${T_PREFIX} bad`, rating: 9, content: 'x', source: 'google', is_active: false });
    expect(bad.error).not.toBeNull();
  });

  it('urut ulang: tukar dua baris uji lalu pulihkan; tidak lengkap → CONFLICT', async () => {
    const rows = await listTestimonials(admin);
    const a = rows.find((row) => row.id === t1)!;
    const b = rows.find((row) => row.id === t2)!;
    const swapped = rows.map((row) => ({
      id: row.id,
      sort_order: row.id === a.id ? b.sort_order : row.id === b.id ? a.sort_order : row.sort_order,
    }));
    expect(await reorderTestimonials(admin, swapped)).toMatchObject({ ok: true });
    const after = await listTestimonials(admin);
    expect(after.find((row) => row.id === a.id)!.sort_order).toBe(b.sort_order);
    expect(await reorderTestimonials(admin, swapped.slice(1))).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(
      await reorderTestimonials(admin, [{ id: '00000000-0000-4000-8000-000000000000', sort_order: 1 }]),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('hapus: baris hilang; hapus lagi → NOT_FOUND; baris asli utuh', async () => {
    expect(await deleteTestimonial(admin, t1)).toMatchObject({ ok: true });
    expect(await deleteTestimonial(admin, t2)).toMatchObject({ ok: true });
    expect(await deleteTestimonial(admin, t1)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    const { data } = await getBuildClient().from('testimonials').select('customer_name');
    expect((data ?? []).some((row) => row.customer_name.startsWith(T_PREFIX))).toBe(false);
  });

  it('cabang dihapus → testimoni tetap ada, cabang kosong (ON DELETE SET NULL)', async () => {
    const { data: tempBranch, error } = await service
      .from('branches')
      .insert({
        slug: `uji-int-tst-${RUN}`,
        name: `UJI-INT Testimoni cabang ${RUN}`,
        region: 'bandung_raya',
        address: 'Jl. Uji',
        city: 'Kota Bandung',
        province: 'Jawa Barat',
        is_active: false,
        sort_order: 901,
      })
      .select('id')
      .single();
    if (error) throw error;
    const made = await createTestimonial(admin, tst({ customer_name: `${T_PREFIX} C`, branch_id: tempBranch.id }));
    expect(made.ok).toBe(true);
    await service.from('branches').delete().eq('id', tempBranch.id);
    const { data } = await service.from('testimonials').select('branch_id').like('customer_name', `${T_PREFIX} C`).single();
    expect(data!.branch_id).toBeNull();
    if (made.ok) await deleteTestimonial(admin, made.data.id);
  });
});

describe.skipIf(!enabled)('FAQ admin (sesi admin sungguhan)', () => {
  let f1 = '';
  let f2 = '';

  it('buat: di akhir urutan; anon tidak bisa menulis', async () => {
    const before = await listFaqs(admin);
    const a = await createFaq(admin, faq({ n: 'A' }));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    f1 = a.data.id;
    expect(a.data.sort_order).toBe(Math.max(...before.map((row) => row.sort_order)) + 1);
    const b = await createFaq(admin, faq({ n: 'B', answer: 'MENUNGGU KONFIRMASI PEMILIK' }));
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    f2 = b.data.id;

    const anon = await getBuildClient().from('faqs').insert({ question: 'x?', answer: 'y' });
    expect(anon.error).not.toBeNull();
  });

  it('FAQ berjawaban penanda tidak bisa diaktifkan (PATCH); bisa setelah jawaban final (PUT)', async () => {
    const denied = await patchFaq(admin, f2, faqPatchSchema.parse({ is_active: true }));
    expect(denied).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    if (!denied.ok) expect(denied.details).toHaveProperty('answer');
    expect((await listFaqs(admin)).find((row) => row.id === f2)!.is_active).toBe(false);

    const fixed = await updateFaq(admin, f2, faq({ n: 'B', answer: 'Jawaban final uji.', is_active: false }));
    expect(fixed).toMatchObject({ ok: true, data: { answer: 'Jawaban final uji.' } });
    // Aktif lalu nonaktif lagi segera (tidak tampil lama di situs dev).
    expect(await patchFaq(admin, f2, { is_active: true })).toMatchObject({ ok: true });
    expect(await patchFaq(admin, f2, { is_active: false })).toMatchObject({ ok: true });
  });

  it('PUT menolak FAQ aktif tanpa jawaban final lewat skema', () => {
    expect(
      faqCreateSchema.safeParse({ question: 'Apa kabar?', answer: 'MENUNGGU KONFIRMASI', is_active: true })
        .success,
    ).toBe(false);
  });

  it('urut ulang: tukar dua baris uji lalu pulihkan; tidak lengkap → CONFLICT', async () => {
    const rows = await listFaqs(admin);
    const a = rows.find((row) => row.id === f1)!;
    const b = rows.find((row) => row.id === f2)!;
    const swapped = rows.map((row) => ({
      id: row.id,
      sort_order: row.id === a.id ? b.sort_order : row.id === b.id ? a.sort_order : row.sort_order,
    }));
    expect(await reorderFaqs(admin, swapped)).toMatchObject({ ok: true });
    expect((await listFaqs(admin)).find((row) => row.id === a.id)!.sort_order).toBe(b.sort_order);
    expect(await reorderFaqs(admin, swapped.slice(1))).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('hapus; data publik: baris uji tidak terbaca anon dan 8 FAQ asli utuh', async () => {
    expect(await deleteFaq(admin, f1)).toMatchObject({ ok: true });
    expect(await deleteFaq(admin, f2)).toMatchObject({ ok: true });
    expect(await deleteFaq(admin, f1)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    const { data } = await service.from('faqs').select('question');
    expect((data ?? []).filter((row) => row.question.startsWith(F_PREFIX))).toHaveLength(0);
    expect((data ?? []).length).toBe(8);
  });
});
