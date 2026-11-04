import { describe, expect, it } from 'vitest';
import { leadSchema, zodToDetails } from '@/lib/validation/lead';

const academy = {
  type: 'academy',
  full_name: 'Budi Santoso',
  whatsapp_number: '0812-3456-7890',
  city: 'Bandung',
  age: '',
  experience: 'belum_pernah',
  message: '',
  consent: true,
};

const partnership = {
  type: 'partnership',
  full_name: 'Ani',
  whatsapp_number: '6281234567890',
  city: 'Bogor',
  email: '',
  location_status: 'belum_ada',
  consent: true,
};

const errorsOf = (input: unknown) => {
  const result = leadSchema.safeParse(input);
  return result.success ? {} : zodToDetails(result.error);
};

describe('leadSchema', () => {
  it('academy valid: nomor dinormalisasi, field opsional kosong jadi undefined', () => {
    const result = leadSchema.parse(academy);
    expect(result.whatsapp_number).toBe('6281234567890');
    expect(result.message).toBeUndefined();
    expect(result.type === 'academy' && result.age).toBeUndefined();
  });

  it('kemitraan valid', () => {
    expect(leadSchema.safeParse(partnership).success).toBe(true);
  });

  it.each(['123', '0812', 'abcdefghijkl', '1234567890123'])('menolak nomor %s', (value) => {
    expect(errorsOf({ ...academy, whatsapp_number: value }).whatsapp_number).toBe(
      'Nomor WhatsApp harus 10–15 digit dan diawali 08 atau 62.',
    );
  });

  it('nama & kota 2–100 karakter', () => {
    expect(errorsOf({ ...academy, full_name: 'A' }).full_name).toBe('Nama minimal 2 karakter.');
    expect(errorsOf({ ...academy, city: 'x'.repeat(101) }).city).toContain('maksimal 100');
  });

  it('usia opsional 15–60', () => {
    expect(errorsOf({ ...academy, age: '14' }).age).toBe('Usia minimal 15 tahun.');
    expect(errorsOf({ ...academy, age: '61' }).age).toBe('Usia maksimal 60 tahun.');
    expect(errorsOf({ ...academy, age: '25' }).age).toBeUndefined();
  });

  it('persetujuan wajib', () => {
    expect(errorsOf({ ...academy, consent: false }).consent).toBe(
      'Centang persetujuan untuk melanjutkan.',
    );
  });

  it('pesan maksimal 1000 karakter', () => {
    expect(errorsOf({ ...academy, message: 'x'.repeat(1001) }).message).toContain('1000');
  });

  it('email kemitraan opsional tapi harus valid', () => {
    expect(errorsOf({ ...partnership, email: 'bukan-email' }).email).toBe(
      'Format email tidak valid.',
    );
    expect(errorsOf({ ...partnership, email: 'a@b.co' }).email).toBeUndefined();
  });

  it('pilihan enum wajib', () => {
    expect(errorsOf({ ...academy, experience: undefined }).experience).toBeDefined();
    expect(errorsOf({ ...partnership, location_status: undefined }).location_status).toBeDefined();
  });
});
