import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { jsonSource } from '@/lib/data/json';
import { supabaseSource } from '@/lib/data/supabase';
import { getBuildClient } from '@/lib/supabase/build';
import { getServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/types/database';

const anon = getBuildClient();
const service = getServiceClient();

const TEMP_SLUG = 'uji-rls-sementara';

afterAll(async () => {
  // Bersihkan cabang sementara (branch_services ikut terhapus lewat cascade).
  await service.from('branches').delete().eq('slug', TEMP_SLUG);
});

describe('kesamaan data Supabase dengan seed JSON (DoD M2)', () => {
  // Urutan antar-grup tidak dijamin (sort_order hanya berarti di dalam cabang/kategori),
  // jadi bandingkan setelah diurutkan dengan kunci tetap.
  const by =
    <T>(...keys: (keyof T)[]) =>
    (a: T, b: T) =>
      keys
        .map((k) => String(a[k]).padStart(6, '0').localeCompare(String(b[k]).padStart(6, '0')))
        .find((c) => c !== 0) ?? 0;

  it('cabang: identik dan berurutan sort_order', async () => {
    expect(await supabaseSource.getBranches()).toEqual(await jsonSource.getBranches());
  });

  it('layanan, FAQ, galeri, testimoni, pengaturan: identik', async () => {
    const services = [await supabaseSource.getServices(), await jsonSource.getServices()];
    const [dbServices, seedServices] = services.map((rows) =>
      [...rows].sort(by('category', 'sort_order', 'slug')),
    );
    expect(dbServices).toEqual(seedServices);
    expect(await supabaseSource.getFaqs()).toEqual(await jsonSource.getFaqs());
    expect(await supabaseSource.getGallery()).toEqual(await jsonSource.getGallery());
    expect(await supabaseSource.getTestimonials()).toEqual(await jsonSource.getTestimonials());
    expect(await supabaseSource.getSettings()).toEqual(await jsonSource.getSettings());
  });

  it('barber dan ketersediaan layanan: identik (urutan antar-cabang diabaikan)', async () => {
    const [dbBarbers, seedBarbers] = [
      await supabaseSource.getBarbers(),
      await jsonSource.getBarbers(),
    ].map((rows) => [...rows].sort(by('branch_slug', 'sort_order', 'name', 'label')));
    expect(dbBarbers).toEqual(seedBarbers);

    const [dbMatrix, seedMatrix] = [
      await supabaseSource.getBranchServices(),
      await jsonSource.getBranchServices(),
    ].map((rows) => [...rows].sort(by('branch_slug', 'service_slug')));
    expect(dbMatrix).toEqual(seedMatrix);
  });

  it('cek acak 3 cabang: data cabang, jumlah barber, harga Aditia', async () => {
    for (const slug of ['dipatiukur', 'dago', 'citra-raya']) {
      expect(await supabaseSource.getBranchBySlug(slug)).toEqual(
        await jsonSource.getBranchBySlug(slug),
      );
      expect((await supabaseSource.getBarbersByBranch(slug)).length).toBe(
        (await jsonSource.getBarbersByBranch(slug)).length,
      );
    }
    const aditia = (await supabaseSource.getBarbersByBranch('dipatiukur')).find(
      (barber) => barber.name === 'Aditia',
    );
    expect(aditia).toMatchObject({ haircut_price: 130000, haircut_original_price: 150000 });
  });
});

describe('RLS: anon (kunci publik)', () => {
  it('tidak bisa insert ke tabel konten', async () => {
    const { error } = await anon.from('branches').insert({
      slug: 'ngawur',
      name: 'Ngawur',
      region: 'bandung_raya',
      address: 'x',
      city: 'x',
      province: 'x',
    });
    expect(error).not.toBeNull();
  });

  it('update dan delete tidak mengubah baris apa pun', async () => {
    const updated = await anon
      .from('branches')
      .update({ name: 'Diretas' })
      .eq('slug', 'dago')
      .select();
    expect(updated.data ?? []).toHaveLength(0);
    const deleted = await anon.from('branches').delete().eq('slug', 'dago').select();
    expect(deleted.data ?? []).toHaveLength(0);
    const { data } = await service.from('branches').select('name').eq('slug', 'dago').single();
    expect(data?.name).toBe('Dago');

    for (const table of ['barbers', 'services', 'faqs', 'gallery_items', 'testimonials'] as const) {
      const res = await anon.from(table).delete().not('id', 'is', null).select();
      expect(res.data ?? [], table).toHaveLength(0);
    }
  });

  it('select hanya baris aktif', async () => {
    const { error } = await service.from('branches').insert({
      slug: TEMP_SLUG,
      name: 'Uji RLS',
      region: 'bandung_raya',
      address: 'x',
      city: 'x',
      province: 'x',
      is_active: false,
    });
    expect(error).toBeNull();

    const hidden = await anon.from('branches').select('slug').eq('slug', TEMP_SLUG);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toHaveLength(0);

    const all = await anon.from('branches').select('is_active');
    expect(all.data?.length).toBe(11);
    expect(all.data?.every((row) => row.is_active)).toBe(true);

    // Trigger mengisi 14 baris branch_services untuk cabang baru; anon tidak boleh melihatnya.
    const bs = await service
      .from('branch_services')
      .select('branch_id, branches!inner(slug)')
      .eq('branches.slug', TEMP_SLUG);
    expect(bs.data?.length).toBe(14);
    const anonBs = await anon
      .from('branch_services')
      .select('branch_id, branches!inner(slug)')
      .eq('branches.slug', TEMP_SLUG);
    expect(anonBs.data ?? []).toHaveLength(0);
  });

  it('tidak punya akses ke leads, admin_profiles, publish_logs', async () => {
    for (const table of ['leads', 'admin_profiles', 'publish_logs'] as const) {
      const res = await anon.from(table).select('*');
      expect(res.data ?? [], table).toHaveLength(0);
    }
    const insert = await anon.from('leads').insert({
      type: 'academy',
      full_name: 'x',
      whatsapp_number: '628123456789',
      city: 'x',
      consent: true,
      ip_hash: 'a'.repeat(64),
    });
    expect(insert.error).not.toBeNull();
  });

  it('site_settings: bisa dibaca, tidak bisa diubah', async () => {
    const read = await anon.from('site_settings').select('key');
    expect(read.data).toHaveLength(11);
    const before = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'whatsapp_number')
      .single();
    const update = await anon
      .from('site_settings')
      .update({ value: '"0"' })
      .eq('key', 'whatsapp_number')
      .select();
    expect(update.data ?? []).toHaveLength(0);
    const after = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'whatsapp_number')
      .single();
    expect(after.data?.value).toEqual(before.data?.value);
  });

  it('is_admin() tidak bisa dipanggil anon', async () => {
    const { error } = await anon.rpc('is_admin');
    expect(error).not.toBeNull();
  });

  it('storage media: tulis ditolak, daftar isi tidak bisa dienumerasi', async () => {
    const upload = await anon.storage
      .from('media')
      .upload('uji/ngawur.png', new Blob(['x'], { type: 'image/png' }));
    expect(upload.error).not.toBeNull();
    const list = await anon.storage.from('media').list();
    expect(list.data ?? []).toHaveLength(0);
  });
});

describe('constraint database', () => {
  it('menolak data yang melanggar aturan PRD', async () => {
    const base = {
      slug: 'x-cek',
      name: 'x',
      region: 'bandung_raya',
      address: 'x',
      city: 'x',
      province: 'x',
    } as const;
    const attempt = async (patch: Partial<Database['public']['Tables']['branches']['Insert']>) => {
      const res = await service.from('branches').insert({ ...base, ...patch });
      if (!res.error) await service.from('branches').delete().eq('slug', 'x-cek');
      return res.error;
    };
    expect(await attempt({ slug: 'Slug Salah' })).not.toBeNull();
    expect(await attempt({ postal_code: '1234' })).not.toBeNull();
    expect(await attempt({ open_time: '23:00', close_time: '08:00' })).not.toBeNull();
    expect(await attempt({ is_flagship: true })).not.toBeNull(); // Dipatiukur sudah pusat
  });

  it('leads: consent harus true dan nomor WA ternormalisasi', async () => {
    const lead = { type: 'academy', full_name: 'x', city: 'x', ip_hash: 'a'.repeat(64) } as const;
    const noConsent = await service
      .from('leads')
      .insert({ ...lead, whatsapp_number: '628123456789', consent: false });
    expect(noConsent.error).not.toBeNull();
    const badNumber = await service
      .from('leads')
      .insert({ ...lead, whatsapp_number: '0812345', consent: true });
    expect(badNumber.error).not.toBeNull();
  });

  it('kunci salah ditolak', async () => {
    const bad = createClient<Database>(process.env.PUBLIC_SUPABASE_URL!, 'sb_publishable_salah');
    const { error } = await bad.from('branches').select('slug');
    expect(error).not.toBeNull();
  });
});
