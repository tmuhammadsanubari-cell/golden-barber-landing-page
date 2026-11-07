import { describe, expect, it } from 'vitest';
import {
  fieldToPhone,
  insertPlaceholder,
  parseCount,
  parseRating,
  phoneToField,
  previewTemplate,
  ratingToField,
  sameValue,
} from '@/lib/admin/settings';
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { getSettings } from '@/lib/data';
import {
  EDITABLE_KEYS,
  SETTINGS_SCHEMAS,
  TEMPLATE_KEYS,
  TEMPLATE_PLACEHOLDERS,
  aboutHighlightsSchema,
  googleRatingSchema,
  haircutIncludesSchema,
  heroSchema,
  isEditableKey,
  socialLinksSchema,
  unknownPlaceholders,
  whatsappNumberSchema,
  whatsappTemplatesSchema,
} from '@/lib/validation/admin-settings';
import settingsSeed from '@/data/seed/site-settings.json';

describe('seed lolos skema: nilai awal selalu valid', () => {
  for (const key of EDITABLE_KEYS) {
    it(key, () => {
      const result = SETTINGS_SCHEMAS[key].safeParse(
        (settingsSeed as Record<string, unknown>)[key],
      );
      expect(result.error?.issues ?? []).toEqual([]);
    });
  }
});

describe('whatsappNumberSchema', () => {
  it('menormalkan berbagai penulisan ke 628…', () => {
    for (const input of ['0812-1480-7192', '+62 812 1480 7192', '6281214807192', '081214807192']) {
      expect(whatsappNumberSchema.parse(input)).toBe('6281214807192');
    }
  });
  it('menolak nomor bukan ponsel Indonesia / terlalu pendek / huruf', () => {
    for (const input of ['', '123', '0212345678', '+1 555 123 4567', 'abc', '08121']) {
      expect(whatsappNumberSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('socialLinksSchema', () => {
  const ok = {
    instagram: 'https://www.instagram.com/goldenbarber_id/',
    threads: 'https://www.threads.com/@goldenbarber_id',
    linktree: 'https://linktr.ee/Goldenbarberindonesia',
    academy_instagram: 'https://www.instagram.com/goldenacademybandung/',
  };
  it('lolos; linktree boleh kosong', () => {
    expect(socialLinksSchema.safeParse(ok).success).toBe(true);
    expect(socialLinksSchema.safeParse({ ...ok, linktree: '' }).success).toBe(true);
  });
  it('hanya https; menolak javascript:, http, bukan URL, dan domain salah', () => {
    for (const bad of [
      'javascript:alert(1)',
      'http://www.instagram.com/x',
      'instagram.com/x',
      'goldenbarber_id',
      'https://evil.example/instagram.com/x',
    ]) {
      expect(socialLinksSchema.safeParse({ ...ok, instagram: bad }).success).toBe(false);
    }
    expect(socialLinksSchema.safeParse({ ...ok, linktree: 'javascript:alert(1)' }).success).toBe(false);
    expect(socialLinksSchema.safeParse({ ...ok, threads: 'https://www.threads.com/goldenbarber' }).success).toBe(false);
  });
  it('handle Instagram tetap terbaca Navbar (instagram.com/{handle})', () => {
    const url = socialLinksSchema.parse(ok).instagram;
    expect(url.match(/instagram\.com\/([^/]+)/)?.[1]).toBe('goldenbarber_id');
  });
});

describe('template WA: placeholder dibatasi agar build tidak gagal', () => {
  const base = Object.fromEntries(
    TEMPLATE_KEYS.map((key) => [key, (settingsSeed.whatsapp_templates as Record<string, string>)[key]]),
  );

  it('unknownPlaceholders', () => {
    expect(unknownPlaceholders('Halo {nama_cabang} {x} {x} {y}', ['nama_cabang'])).toEqual(['x', 'y']);
    expect(unknownPlaceholders('Tanpa placeholder', [])).toEqual([]);
  });
  it('menolak placeholder yang tidak tersedia di template itu, dengan daftar yang tersedia', () => {
    const result = whatsappTemplatesSchema.safeParse({ ...base, general: 'Halo {nama_cabang}' });
    expect(result.success).toBe(false);
    const message = result.error!.issues[0]!.message;
    expect(message).toContain('{nama_cabang}');
    expect(message).toContain('tidak memakai placeholder');
    const academy = whatsappTemplatesSchema.safeParse({ ...base, academy: 'Halo {nama_barber}' });
    expect(academy.error!.issues[0]!.message).toContain('{nama}');
  });
  it('menerima semua placeholder yang tersedia dan teks wajar', () => {
    expect(
      whatsappTemplatesSchema.safeParse({
        ...base,
        barber: 'Booking {layanan} dengan {nama_barber} di {nama_cabang} ({harga})',
      }).success,
    ).toBe(true);
  });
  it('panjang 5–500', () => {
    expect(whatsappTemplatesSchema.safeParse({ ...base, general: 'Hai' }).success).toBe(false);
    expect(whatsappTemplatesSchema.safeParse({ ...base, general: 'x'.repeat(501) }).success).toBe(false);
  });
  it('template lolos skema SELALU bisa dibangun (tidak melempar) dengan data yang disediakan situs', async () => {
    // Pemanggil di situs memberi: branch (nama), barber/layanan/harga (barber), layanan (service), nama (lead).
    const settings = await getSettings();
    const args = {
      settings: { ...settings, whatsapp_templates: whatsappTemplatesSchema.parse(base) },
      branch: { slug: 'dago', name: 'Dago', whatsapp_number: null },
      barber: 'Aditia',
      service: 'Highlight',
      price: 130000,
      name: 'Rizky',
    };
    for (const key of TEMPLATE_KEYS) {
      expect(() => buildWhatsAppMessage({ ...args, context: key })).not.toThrow();
    }
    // Semua placeholder yang diizinkan benar-benar terisi di konteksnya.
    for (const key of TEMPLATE_KEYS) {
      const allPlaceholders = TEMPLATE_PLACEHOLDERS[key].map((name) => `{${name}}`).join(' ');
      const withAll = { ...args.settings.whatsapp_templates, [key]: `x ${allPlaceholders}`.trim() };
      expect(() =>
        buildWhatsAppMessage({ ...args, settings: { ...args.settings, whatsapp_templates: withAll }, context: key }),
      ).not.toThrow();
    }
  });
});

describe('heroSchema / rating / daftar', () => {
  const hero = { ...settingsSeed.hero };
  it('hero: judul 5–120, subjudul 10–160, path gambar bucket atau aset situs', () => {
    expect(heroSchema.safeParse(hero).success).toBe(true);
    expect(heroSchema.safeParse({ ...hero, title: 'Ha' }).success).toBe(false);
    expect(heroSchema.safeParse({ ...hero, subtitle: 'x'.repeat(161) }).success).toBe(false);
    expect(heroSchema.safeParse({ ...hero, image_path: 'https://evil.example/x.png' }).success).toBe(false);
    expect(
      heroSchema.safeParse({ ...hero, image_path: 'site/6f1c8e0a-0b1c-4d2e-8f3a-123456789abc.webp' }).success,
    ).toBe(true);
  });
  it('rating: 1–5 satu desimal; ulasan bulat ≥ 0; tanggal valid', () => {
    const base = { rating: 4.9, review_count: 3340, scope: 'Cabang Dipatiukur', updated_at: '2026-11-03' };
    expect(googleRatingSchema.safeParse(base).success).toBe(true);
    for (const patch of [
      { rating: 5.1 },
      { rating: 0.9 },
      { rating: 4.55 },
      { rating: Number.NaN },
      { review_count: -1 },
      { review_count: 1.5 },
      { updated_at: '3 Nov 2026' },
      { updated_at: '2026-13-45' },
      { scope: '' },
    ]) {
      expect(googleRatingSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    }
  });
  it('keunggulan 1–8 dengan ikon dari daftar; termasuk 1–8 item', () => {
    const item = { icon: 'star', title: 'Judul', description: 'Deskripsi poin.' };
    expect(aboutHighlightsSchema.safeParse([item]).success).toBe(true);
    expect(aboutHighlightsSchema.safeParse([]).success).toBe(false);
    expect(aboutHighlightsSchema.safeParse(Array(9).fill(item)).success).toBe(false);
    expect(aboutHighlightsSchema.safeParse([{ ...item, icon: 'rocket' }]).success).toBe(false);
    expect(haircutIncludesSchema.safeParse(['Konsultasi']).success).toBe(true);
    expect(haircutIncludesSchema.safeParse([]).success).toBe(false);
    expect(haircutIncludesSchema.safeParse(['']).success).toBe(false);
  });
  it('isEditableKey: media_mentions dan seo_defaults tidak', () => {
    expect(isEditableKey('hero')).toBe(true);
    expect(isEditableKey('media_mentions')).toBe(false);
    expect(isEditableKey('seo_defaults')).toBe(false);
    expect(isEditableKey('bukan_kunci')).toBe(false);
  });
});

describe('helper form', () => {
  it('previewTemplate memakai data contoh dan membiarkan placeholder asing', () => {
    expect(previewTemplate('Halo {nama_cabang}, {nama_barber} {harga} {x}')).toBe(
      'Halo Dipatiukur, Aditia 130K {x}',
    );
  });
  it('insertPlaceholder: di kursor, mengganti pilihan, di luar batas dijepit', () => {
    expect(insertPlaceholder('Halo , siap', 'nama', 5, 5)).toEqual({ text: 'Halo {nama}, siap', cursor: 11 });
    expect(insertPlaceholder('Halo XXX siap', 'nama', 5, 8)).toEqual({ text: 'Halo {nama} siap', cursor: 11 });
    expect(insertPlaceholder('abc', 'nama', 99, 99).text).toBe('abc{nama}');
    expect(insertPlaceholder('', 'nama', 0, 0)).toEqual({ text: '{nama}', cursor: 6 });
  });
  it('nomor: simpan ↔ isian', () => {
    expect(phoneToField('6281214807192')).toBe('812-1480-7192');
    expect(fieldToPhone('812-1480-7192')).toBe('6281214807192');
    expect(fieldToPhone('0812 1480 7192')).toBe('6281214807192');
    expect(fieldToPhone('+62 812-1480-7192')).toBe('6281214807192');
  });
  it('rating dan jumlah ulasan: koma/titik ribuan', () => {
    expect(parseRating('4,9')).toBe(4.9);
    expect(parseRating('4.9')).toBe(4.9);
    expect(parseRating('abc')).toBeNaN();
    expect(ratingToField(4.9)).toBe('4,9');
    expect(parseCount('3.340')).toBe(3340);
    expect(parseCount('3340')).toBe(3340);
    expect(parseCount('3,5')).toBeNaN();
  });
  it('sameValue membandingkan isi, bukan referensi', () => {
    expect(sameValue({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
  });
});
