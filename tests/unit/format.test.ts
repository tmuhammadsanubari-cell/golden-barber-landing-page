import { describe, expect, it } from 'vitest';
import {
  formatDateId,
  formatHours,
  formatPriceRange,
  formatPriceShort,
  formatRating,
  formatRupiah,
  parsePriceInput,
} from '@/lib/format';

describe('formatPriceShort', () => {
  it('menampilkan ribuan dengan sufiks K', () => {
    expect(formatPriceShort(130000)).toBe('130K');
    expect(formatPriceShort(50000)).toBe('50K');
  });
  it('memakai pemisah Indonesia untuk angka besar & pecahan', () => {
    expect(formatPriceShort(1250000)).toBe('1.250K');
    expect(formatPriceShort(62500)).toBe('62,5K');
  });
});

describe('formatRupiah', () => {
  it('memakai titik ribuan tanpa spasi', () => {
    expect(formatRupiah(130000)).toBe('Rp130.000');
  });
});

describe('parsePriceInput', () => {
  it.each([
    ['130K', 130000],
    ['130k', 130000],
    ['130.000', 130000],
    ['130000', 130000],
    ['Rp130.000', 130000],
    [' Rp 130.000 ', 130000],
    ['62,5K', 62500],
    ['1.250K', 1250000],
  ])('%s → %i', (input, expected) => {
    expect(parsePriceInput(input)).toBe(expected);
  });
  it.each(['', 'abc', '130.00', '12K5', '-5000'])('menolak %j', (input) => {
    expect(parsePriceInput(input)).toBeNull();
  });
});

describe('formatPriceRange', () => {
  it('menampilkan rentang', () => {
    expect(formatPriceRange(85000, 130000)).toBe('85K–130K');
  });
  it('satu harga saat min = max atau max kosong', () => {
    expect(formatPriceRange(70000, 70000)).toBe('70K');
    expect(formatPriceRange(70000)).toBe('70K');
  });
});

describe('format lain', () => {
  it('jam buka', () => expect(formatHours('08:00', '23:00')).toBe('08.00–23.00'));
  it('rating', () => expect(formatRating(4.9)).toBe('4,9'));
  it('tanggal', () => expect(formatDateId('2026-11-01')).toBe('1 November 2026'));
});
