import { describe, expect, it } from 'vitest';
import barbersJson from '@/data/seed/barbers.json';
import branchesJson from '@/data/seed/branches.json';
import settingsJson from '@/data/seed/site-settings.json';
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatPhoneDisplay,
  normalizePhone,
  whatsAppLinkProps,
} from '@/lib/whatsapp';
import type { WhatsAppSettings } from '@/types/content';

const settings = settingsJson as WhatsAppSettings;
const dago = { slug: 'dago', name: 'Dago', whatsapp_number: null };
const dipatiukur = { slug: 'dipatiukur', name: 'Dipatiukur', whatsapp_number: null };
const citraRaya = { slug: 'citra-raya', name: 'Citra Raya', whatsapp_number: null };

const textOf = (url: string) => decodeURIComponent(url.split('?text=')[1]!);

describe('normalizePhone', () => {
  it.each([
    ['0812-1480-7192', '6281214807192'],
    ['0812 1480 7192', '6281214807192'],
    ['+62 812 1480 7192', '6281214807192'],
    ['6281214807192', '6281214807192'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));
});

describe('formatPhoneDisplay', () => {
  it.each([
    ['6281214807192', '0812-1480-7192'],
    ['0812 1480 7192', '0812-1480-7192'],
    ['+62 811-2222-333', '0811-2222-333'],
  ])('%s → %s', (input, expected) => expect(formatPhoneDisplay(input)).toBe(expected));
});

describe('semua data seed menghasilkan URL WhatsApp yang sah', () => {
  const branchBySlug = new Map(branchesJson.map((b) => [b.slug, b]));

  it('setiap cabang: konteks cabang memuat nama cabang dan nomor wa.me valid', () => {
    for (const branch of branchesJson) {
      const url = buildWhatsAppUrl({ context: 'branch', settings, branch });
      expect(url).toMatch(/^https:\/\/wa\.me\/62\d{8,13}\?text=/);
      expect(textOf(url)).toContain(branch.name);
    }
  });

  it('setiap barber aktif: pesan memuat nama barber, cabang, dan harga "K"', () => {
    const active = barbersJson.filter((b) => b.is_active);
    expect(active.length).toBeGreaterThan(0);
    for (const barber of active) {
      const branch = branchBySlug.get(barber.branch_slug);
      expect(branch, barber.branch_slug).toBeDefined();
      const text = textOf(
        buildWhatsAppUrl({
          context: 'barber',
          settings,
          branch: branch!,
          barber: barber.name,
          service: 'Haircut Reguler',
          price: barber.haircut_price,
        }),
      );
      expect(text).toContain(branch!.name);
      expect(text).toContain(barber.name);
      expect(text).toContain(`(${barber.haircut_price / 1000}K)`);
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it('teks pesan bisa di-decode kembali persis (tanpa karakter hilang)', () => {
    const message = buildWhatsAppMessage({ context: 'academy', settings, name: 'Ña #1 ?&=' });
    const url = buildWhatsAppUrl({ context: 'academy', settings, name: 'Ña #1 ?&=' });
    expect(textOf(url)).toBe(message);
    expect(url.split('?text=')[1]).not.toMatch(/[ #&?=]/);
  });
});

describe('buildWhatsAppUrl', () => {
  it('konteks umum', () => {
    const url = buildWhatsAppUrl({ context: 'general', settings });
    expect(url.startsWith('https://wa.me/6281214807192?text=')).toBe(true);
    expect(textOf(url)).toBe(settings.whatsapp_templates.general);
  });

  it('konteks cabang', () => {
    expect(textOf(buildWhatsAppUrl({ context: 'branch', settings, branch: dago }))).toBe(
      'Halo Golden Barber Dago, saya mau booking potong rambut. Apakah ada slot hari ini?',
    );
  });

  it('konteks barber: Aditia Dipatiukur', () => {
    const url = buildWhatsAppUrl({
      context: 'barber',
      settings,
      branch: dipatiukur,
      barber: 'Aditia',
      service: 'Haircut Reguler',
      price: 130000,
    });
    expect(textOf(url)).toBe(
      'Halo Golden Barber Dipatiukur, saya mau booking Haircut Reguler dengan barber Aditia (130K). Kapan slot yang tersedia?',
    );
  });

  it('konteks layanan', () => {
    const url = buildWhatsAppUrl({
      context: 'service',
      settings,
      branch: dago,
      service: 'Creambath',
    });
    expect(textOf(url)).toBe(
      'Halo Golden Barber, saya mau tanya layanan Creambath di cabang Dago.',
    );
  });

  it('konteks cabang tanpa pricelist: Citra Raya', () => {
    const url = buildWhatsAppUrl({ context: 'branch_no_pricelist', settings, branch: citraRaya });
    expect(textOf(url)).toBe(
      'Halo Golden Barber Citra Raya, boleh minta info pricelist dan alamat lengkap cabang ini?',
    );
  });

  it('konteks academy & kemitraan', () => {
    expect(textOf(buildWhatsAppUrl({ context: 'academy', settings, name: 'Budi' }))).toContain(
      'saya Budi baru saja mengisi form minat',
    );
    expect(textOf(buildWhatsAppUrl({ context: 'partnership', settings, name: 'Budi' }))).toContain(
      'saya Budi baru saja mengisi form kemitraan',
    );
  });

  it('meng-encode teks pesan', () => {
    const url = buildWhatsAppUrl({ context: 'academy', settings, name: 'Budi & Ani' });
    expect(url).toContain('Budi%20%26%20Ani');
    expect(url).not.toContain(' ');
  });

  it('memakai nomor cabang bila terisi', () => {
    const url = buildWhatsAppUrl({
      context: 'branch',
      settings,
      branch: { ...dago, whatsapp_number: '0811-2222-3333' },
    });
    expect(url.startsWith('https://wa.me/6281122223333?')).toBe(true);
  });

  it('error bila placeholder tidak terisi', () => {
    expect(() => buildWhatsAppUrl({ context: 'branch', settings })).toThrow('{nama_cabang}');
    expect(() => buildWhatsAppMessage({ context: 'barber', settings, branch: dago })).toThrow();
  });

  it('error bila template punya placeholder tak dikenal', () => {
    const broken: WhatsAppSettings = {
      ...settings,
      whatsapp_templates: { ...settings.whatsapp_templates, general: 'Halo {siapa}' },
    };
    expect(() => buildWhatsAppUrl({ context: 'general', settings: broken })).toThrow('{siapa}');
  });
});

describe('whatsAppLinkProps', () => {
  it('menyertakan atribut tab baru & tracking', () => {
    expect(whatsAppLinkProps({ context: 'branch', settings, branch: dago })).toMatchObject({
      target: '_blank',
      rel: 'noopener',
      'data-wa-context': 'branch',
      'data-branch': 'dago',
    });
  });
  it('branch_no_pricelist dilacak sebagai branch', () => {
    const props = whatsAppLinkProps({
      context: 'branch_no_pricelist',
      settings,
      branch: citraRaya,
    });
    expect(props['data-wa-context']).toBe('branch');
  });
});
