import { describe, expect, it } from 'vitest';
import {
  filterBarbers,
  parsePriceCell,
  priceAria,
  priceEditText,
  priceSummary,
  priceText,
  summaryText,
} from '@/lib/admin/barbers';
import {
  barberCreateSchema,
  barberPatchSchema,
  barberReorderSchema,
  checkPrices,
  moveSchema,
} from '@/lib/validation/admin-barbers';

const BRANCH = '11111111-1111-4111-8111-111111111111';

function errorsOf(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
  input: unknown,
) {
  const result = schema.safeParse(input) as {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error!.issues) out[String(issue.path[0] ?? '_')] ??= issue.message;
  return out;
}

describe('parsePriceCell (isian sel harga)', () => {
  it('angka polos 1–3 digit dibaca ribuan, seperti sufiks K di mockup', () => {
    expect(parsePriceCell('130')).toBe(130000);
    expect(parsePriceCell('85')).toBe(85000);
    expect(parsePriceCell(' 100 ')).toBe(100000);
  });

  it('format PRD tetap berlaku: 130K, 130.000, 130000, Rp130.000', () => {
    expect(parsePriceCell('130K')).toBe(130000);
    expect(parsePriceCell('130k')).toBe(130000);
    expect(parsePriceCell('130.000')).toBe(130000);
    expect(parsePriceCell('130000')).toBe(130000);
    expect(parsePriceCell('Rp130.000')).toBe(130000);
    expect(parsePriceCell('62,5K')).toBe(62500);
  });

  it('kosong → null; sampah → undefined', () => {
    expect(parsePriceCell('')).toBeNull();
    expect(parsePriceCell('   ')).toBeNull();
    expect(parsePriceCell('abc')).toBeUndefined();
    expect(parsePriceCell('12ab')).toBeUndefined();
    expect(parsePriceCell('-5')).toBeUndefined();
  });

  it('empat digit ke atas dibaca rupiah penuh (bisa jatuh di bawah minimum)', () => {
    expect(parsePriceCell('5000')).toBe(5000);
    expect(parsePriceCell('1500000')).toBe(1500000);
  });
});

describe('tampil harga', () => {
  it('teks edit, teks tampil, aria', () => {
    expect(priceEditText(130000)).toBe('130');
    expect(priceEditText(125500)).toBe('125500');
    expect(priceEditText(null)).toBe('');
    expect(priceEditText(1000000)).toBe('1000000');
    expect(priceEditText(999000)).toBe('999');
    expect(priceText(130000)).toBe('130K');
    expect(priceText(null)).toBe('—');
    expect(priceAria('Haircut Reguler', 'Aditia', 130000)).toBe(
      'Haircut Reguler Aditia: Rp130.000',
    );
    expect(priceAria('Harga Coret', 'Riko', null)).toBe('Harga Coret Riko: kosong');
  });

  it('teks edit bisa dibaca balik menjadi nilai yang sama', () => {
    for (const value of [130000, 85000, 125500, 1000000]) {
      expect(parsePriceCell(priceEditText(value))).toBe(value);
    }
  });

  it('ringkasan baris dan harga', () => {
    expect(summaryText([])).toBe('0 baris');
    expect(summaryText([{ is_generic: false }, { is_generic: false }])).toBe('2 baris · 2 barber');
    expect(summaryText([{ is_generic: false }, { is_generic: true }])).toBe(
      '2 baris · 1 barber + 1 By Barber',
    );
    expect(priceSummary({ haircut_price: 130000, long_trim_price: 150000 })).toBe('130K · LT 150K');
    expect(priceSummary({ haircut_price: 85000, long_trim_price: null })).toBe('85K');
  });

  it('pencarian nama dan label, abaikan huruf besar', () => {
    const items = [
      { name: 'Aditia', label: null },
      { name: 'By Barber', label: 'Tier 1' },
      { name: 'By Barber', label: 'Tier 2' },
    ];
    expect(filterBarbers(items, 'adit')).toHaveLength(1);
    expect(filterBarbers(items, 'BY')).toHaveLength(2);
    expect(filterBarbers(items, 'tier 2')).toHaveLength(1);
    expect(filterBarbers(items, '  ')).toHaveLength(3);
  });
});

describe('skema tambah barber', () => {
  const valid = { branch_id: BRANCH, name: 'Aditia', haircut_price: '130K' };

  it('menormalisasi harga dan mengisi default', () => {
    const result = barberCreateSchema.parse({ ...valid, long_trim_price: '150.000' });
    expect(result.haircut_price).toBe(130000);
    expect(result.long_trim_price).toBe(150000);
    expect(result.haircut_original_price).toBeNull();
    expect(result.long_trim_original_price).toBeNull();
    expect(result.label).toBeNull();
    expect(result.is_generic).toBe(false);
    expect(result.is_active).toBe(true);
  });

  it('harga haircut wajib; min Rp10.000, maks Rp10.000.000', () => {
    expect(errorsOf(barberCreateSchema, { ...valid, haircut_price: '' }).haircut_price).toContain(
      'wajib',
    );
    expect(errorsOf(barberCreateSchema, { ...valid, haircut_price: 9999 }).haircut_price).toBe(
      'Harga minimal Rp10.000.',
    );
    expect(
      errorsOf(barberCreateSchema, { ...valid, haircut_price: 10_000_001 }).haircut_price,
    ).toBe('Harga maksimal Rp10.000.000.');
    expect(
      errorsOf(barberCreateSchema, { ...valid, haircut_price: 10000 }).haircut_price,
    ).toBeUndefined();
    expect(
      errorsOf(barberCreateSchema, { ...valid, haircut_price: 10_000_000 }).haircut_price,
    ).toBeUndefined();
    expect(
      errorsOf(barberCreateSchema, { ...valid, haircut_price: 'murah' }).haircut_price,
    ).toContain('tidak valid');
  });

  it('harga coret wajib lebih besar dari harga aktual', () => {
    const base = { ...valid, haircut_price: 130000 };
    expect(
      errorsOf(barberCreateSchema, { ...base, haircut_original_price: 130000 })
        .haircut_original_price,
    ).toBe('Harga coret harus lebih besar dari harga aktual.');
    expect(
      errorsOf(barberCreateSchema, { ...base, haircut_original_price: '120K' })
        .haircut_original_price,
    ).toBe('Harga coret harus lebih besar dari harga aktual.');
    expect(
      errorsOf(barberCreateSchema, { ...base, haircut_original_price: '150K' })
        .haircut_original_price,
    ).toBeUndefined();
  });

  it('harga coret Long Trim butuh harga Long Trim', () => {
    expect(
      errorsOf(barberCreateSchema, { ...valid, long_trim_original_price: '170K' })
        .long_trim_original_price,
    ).toContain('Long Trim');
    expect(
      errorsOf(barberCreateSchema, {
        ...valid,
        long_trim_price: '150K',
        long_trim_original_price: '140K',
      }).long_trim_original_price,
    ).toBe('Harga coret harus lebih besar dari harga aktual.');
  });

  it('nama wajib dan maks 60; label kosong jadi null', () => {
    expect(errorsOf(barberCreateSchema, { ...valid, name: '  ' }).name).toBe(
      'Nama barber wajib diisi.',
    );
    expect(errorsOf(barberCreateSchema, { ...valid, name: 'x'.repeat(61) }).name).toContain(
      'maksimal 60',
    );
    expect(barberCreateSchema.parse({ ...valid, label: '  ' }).label).toBeNull();
    expect(barberCreateSchema.parse({ ...valid, label: ' Tier 1 ' }).label).toBe('Tier 1');
  });

  it('dua By Barber dengan harga berbeda di satu cabang diizinkan (skema tidak melarang nama kembar)', () => {
    const a = barberCreateSchema.parse({
      ...valid,
      name: 'By Barber',
      is_generic: true,
      label: 'Tier 1',
    });
    const b = barberCreateSchema.parse({
      ...valid,
      name: 'By Barber',
      is_generic: true,
      haircut_price: '100K',
    });
    expect(a.name).toBe(b.name);
    expect(a.is_generic && b.is_generic).toBe(true);
  });

  it('cabang harus UUID', () => {
    expect(errorsOf(barberCreateSchema, { ...valid, branch_id: 'x' }).branch_id).toBe(
      'Pilih cabang.',
    );
  });
});

describe('skema ubah barber (PATCH)', () => {
  it('contoh PRD: harga "120K" dan harga coret 150000', () => {
    const patch = barberPatchSchema.parse({
      haircut_price: '120K',
      haircut_original_price: 150000,
    });
    expect(patch).toEqual({ haircut_price: 120000, haircut_original_price: 150000 });
  });

  it('hanya field yang dikirim yang muncul; null berarti mengosongkan', () => {
    expect(barberPatchSchema.parse({ haircut_original_price: null })).toEqual({
      haircut_original_price: null,
    });
    expect(barberPatchSchema.parse({ haircut_original_price: '' })).toEqual({
      haircut_original_price: null,
    });
    expect(barberPatchSchema.parse({ is_active: false })).toEqual({ is_active: false });
  });

  it('harga haircut tidak boleh dikosongkan', () => {
    expect(errorsOf(barberPatchSchema, { haircut_price: '' }).haircut_price).toContain('wajib');
    expect(errorsOf(barberPatchSchema, { haircut_price: null }).haircut_price).toContain('wajib');
  });

  it('menolak body kosong dan field asing (mis. branch_id, sort_order)', () => {
    expect(errorsOf(barberPatchSchema, {})._).toBe('Tidak ada perubahan yang dikirim.');
    expect(barberPatchSchema.safeParse({ branch_id: BRANCH }).success).toBe(false);
    expect(barberPatchSchema.safeParse({ sort_order: 3 }).success).toBe(false);
  });
});

describe('aturan lintas-kolom checkPrices', () => {
  const base = {
    haircut_price: 130000,
    haircut_original_price: null,
    long_trim_price: null,
    long_trim_original_price: null,
  };

  it('tanpa harga coret selalu valid', () => {
    expect(checkPrices(base)).toEqual({});
  });
  it('coret harus lebih besar, sama dengan aktual juga ditolak', () => {
    expect(checkPrices({ ...base, haircut_original_price: 130000 })).toHaveProperty(
      'haircut_original_price',
    );
    expect(checkPrices({ ...base, haircut_original_price: 130001 })).toEqual({});
  });
  it('coret Long Trim tanpa harga Long Trim ditolak', () => {
    expect(checkPrices({ ...base, long_trim_original_price: 150000 })).toHaveProperty(
      'long_trim_original_price',
    );
  });
});

describe('skema pindah dan urut', () => {
  it('pindah butuh cabang tujuan UUID', () => {
    expect(moveSchema.safeParse({ branch_id: BRANCH }).success).toBe(true);
    expect(moveSchema.safeParse({ branch_id: 'x' }).success).toBe(false);
    expect(moveSchema.safeParse({}).success).toBe(false);
  });

  it('urut menolak kosong, id dobel, urutan negatif', () => {
    const a = { id: BRANCH, sort_order: 1 };
    expect(barberReorderSchema.safeParse([a]).success).toBe(true);
    expect(barberReorderSchema.safeParse([]).success).toBe(false);
    expect(barberReorderSchema.safeParse([a, a]).success).toBe(false);
    expect(barberReorderSchema.safeParse([{ ...a, sort_order: -1 }]).success).toBe(false);
  });
});
