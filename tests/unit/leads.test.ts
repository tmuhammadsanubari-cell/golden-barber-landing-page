import { describe, expect, it } from 'vitest';
import {
  buildLeadRow,
  cleanSourcePath,
  hashIp,
  isHoneypotFilled,
  parseRateLimit,
} from '@/lib/api/leads';
import { leadSchema } from '@/lib/validation/lead';

const meta = { ipHash: 'a'.repeat(64), userAgent: 'Mozilla/5.0', sourcePath: '/' };

describe('hashIp', () => {
  it('SHA-256 heksadesimal 64 karakter, deterministik, bergantung pada salt', () => {
    const a = hashIp('203.0.113.7', 'garam-1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('203.0.113.7', 'garam-1')).toBe(a);
    expect(hashIp('203.0.113.7', 'garam-2')).not.toBe(a);
    expect(hashIp('203.0.113.8', 'garam-1')).not.toBe(a);
    expect(a).not.toContain('203.0.113.7');
  });
});

describe('honeypot', () => {
  it('terisi hanya bila website berisi teks bukan spasi', () => {
    expect(isHoneypotFilled({ website: 'http://spam.example' })).toBe(true);
    expect(isHoneypotFilled({ website: '' })).toBe(false);
    expect(isHoneypotFilled({ website: '   ' })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled('x')).toBe(false);
  });
});

describe('cleanSourcePath', () => {
  it('menerima jalur internal, menolak sisanya', () => {
    expect(cleanSourcePath('/')).toBe('/');
    expect(cleanSourcePath('/cabang/dago/')).toBe('/cabang/dago/');
    expect(cleanSourcePath('//evil.example')).toBeNull();
    expect(cleanSourcePath('https://evil.example')).toBeNull();
    expect(cleanSourcePath('/' + 'a'.repeat(300))).toBeNull();
    expect(cleanSourcePath(42)).toBeNull();
  });
});

describe('parseRateLimit', () => {
  it('default 5; angka bulat positif dari env dipakai', () => {
    expect(parseRateLimit(undefined)).toBe(5);
    expect(parseRateLimit('')).toBe(5);
    expect(parseRateLimit('abc')).toBe(5);
    expect(parseRateLimit('0')).toBe(5);
    expect(parseRateLimit('-3')).toBe(5);
    expect(parseRateLimit('2.5')).toBe(5);
    expect(parseRateLimit('10')).toBe(10);
  });
});

describe('buildLeadRow', () => {
  it('Academy: extra {age, experience}, nomor ternormalisasi, consent true', () => {
    const parsed = leadSchema.parse({
      type: 'academy',
      full_name: 'Budi Santoso',
      whatsapp_number: '0812-3456-7890',
      city: 'Bandung',
      age: '21',
      experience: 'dasar',
      message: '',
      consent: true,
      website: '',
    });
    expect(buildLeadRow(parsed, meta)).toEqual({
      type: 'academy',
      full_name: 'Budi Santoso',
      whatsapp_number: '6281234567890',
      city: 'Bandung',
      message: null,
      extra: { age: 21, experience: 'dasar' },
      consent: true,
      ip_hash: 'a'.repeat(64),
      user_agent: 'Mozilla/5.0',
      source_path: '/',
    });
  });

  it('Academy tanpa usia: extra tidak memuat age', () => {
    const parsed = leadSchema.parse({
      type: 'academy',
      full_name: 'Budi',
      whatsapp_number: '081234567890',
      city: 'Bandung',
      experience: 'belum_pernah',
      consent: true,
    });
    expect(buildLeadRow(parsed, meta).extra).toEqual({ experience: 'belum_pernah' });
  });

  it('Kemitraan: extra {email, location_status}; pesan tersimpan', () => {
    const parsed = leadSchema.parse({
      type: 'partnership',
      full_name: 'Ani',
      whatsapp_number: '+62 812 3456 7890',
      city: 'Bogor',
      email: 'ani@contoh.id',
      location_status: 'sudah_ada',
      message: 'Saya punya ruko.',
      consent: true,
    });
    const row = buildLeadRow(parsed, { ...meta, userAgent: null, sourcePath: null });
    expect(row.whatsapp_number).toBe('6281234567890');
    expect(row.extra).toEqual({ email: 'ani@contoh.id', location_status: 'sudah_ada' });
    expect(row.message).toBe('Saya punya ruko.');
    expect(row.user_agent).toBeNull();
    expect(row.source_path).toBeNull();
  });

  it('user agent dipotong 255 karakter', () => {
    const parsed = leadSchema.parse({
      type: 'partnership',
      full_name: 'Ani',
      whatsapp_number: '081234567890',
      city: 'Bogor',
      location_status: 'belum_ada',
      consent: true,
    });
    expect(buildLeadRow(parsed, { ...meta, userAgent: 'x'.repeat(400) }).user_agent).toHaveLength(
      255,
    );
  });
});
