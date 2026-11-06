import { describe, expect, it } from 'vitest';
import {
  availabilityMap,
  groupByCategory,
  overrideText,
  servicePriceText,
  toServiceForm,
  type BranchServiceRow,
  type ServiceItem,
} from '@/lib/admin/services';
import {
  applyAllSchema,
  availabilityBulkSchema,
  availabilityItemSchema,
  checkOverride,
  checkServicePrice,
  normalizeServicePrice,
  serviceCreateSchema,
  servicePatchSchema,
  serviceReorderSchema,
} from '@/lib/validation/admin-services';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

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

describe('skema layanan', () => {
  const valid = {
    name: 'Hair Spa',
    category: 'hair_treatment',
    price_type: 'fixed',
    price_min: '75K',
  };

  it('menormalisasi harga dan mengisi default', () => {
    const result = serviceCreateSchema.parse(valid);
    expect(result).toMatchObject({
      name: 'Hair Spa',
      price_min: 75000,
      price_max: null,
      note: null,
      description: null,
      is_active: true,
    });
  });

  it('tipe Rentang wajib harga maks yang lebih besar dari harga min', () => {
    const range = { ...valid, price_type: 'range', price_min: 150000 };
    expect(errorsOf(serviceCreateSchema, range).price_max).toBe(
      'Isi harga maksimum untuk tipe Rentang.',
    );
    expect(errorsOf(serviceCreateSchema, { ...range, price_max: 150000 }).price_max).toBe(
      'Harga maksimum harus lebih besar dari harga minimum.',
    );
    expect(errorsOf(serviceCreateSchema, { ...range, price_max: 100000 }).price_max).toContain(
      'lebih besar',
    );
    expect(serviceCreateSchema.parse({ ...range, price_max: '300K' }).price_max).toBe(300000);
  });

  it('tipe Tetap / Mulai dari mengabaikan harga maksimum', () => {
    expect(serviceCreateSchema.parse({ ...valid, price_max: 999000 }).price_max).toBeNull();
    expect(
      serviceCreateSchema.parse({ ...valid, price_type: 'start_from', price_max: 999000 })
        .price_max,
    ).toBeNull();
    // harga maks yang tidak masuk akal pun tidak jadi galat bila diabaikan
    expect(errorsOf(serviceCreateSchema, { ...valid, price_max: 5 }).price_max).toBeDefined();
  });

  it('nama, kategori, dan tipe harga wajib dan valid', () => {
    expect(errorsOf(serviceCreateSchema, { ...valid, name: ' ' }).name).toContain('minimal 2');
    expect(errorsOf(serviceCreateSchema, { ...valid, name: 'x'.repeat(81) }).name).toContain(
      'maksimal 80',
    );
    expect(errorsOf(serviceCreateSchema, { ...valid, category: 'lainnya' }).category).toBe(
      'Pilih kategori.',
    );
    expect(errorsOf(serviceCreateSchema, { ...valid, price_type: 'gratis' }).price_type).toBe(
      'Pilih tipe harga.',
    );
    expect(errorsOf(serviceCreateSchema, { ...valid, price_min: '' }).price_min).toContain('wajib');
    expect(errorsOf(serviceCreateSchema, { ...valid, price_min: 5000 }).price_min).toBe(
      'Harga minimal Rp10.000.',
    );
  });

  it('catatan dan deskripsi kosong jadi null; batas panjang', () => {
    expect(serviceCreateSchema.parse({ ...valid, note: '  ', description: '' })).toMatchObject({
      note: null,
      description: null,
    });
    expect(serviceCreateSchema.parse({ ...valid, note: ' Dark Brown ' }).note).toBe('Dark Brown');
    expect(
      errorsOf(serviceCreateSchema, { ...valid, description: 'x'.repeat(501) }).description,
    ).toContain('maksimal 500');
  });
});

describe('aturan harga layanan', () => {
  it('checkServicePrice hanya berlaku untuk Rentang', () => {
    expect(checkServicePrice({ price_type: 'fixed', price_min: 1, price_max: null })).toEqual({});
    expect(
      checkServicePrice({ price_type: 'range', price_min: 100, price_max: null }),
    ).toHaveProperty('price_max');
    expect(
      checkServicePrice({ price_type: 'range', price_min: 100, price_max: 100 }),
    ).toHaveProperty('price_max');
    expect(checkServicePrice({ price_type: 'range', price_min: 100, price_max: 101 })).toEqual({});
  });

  it('normalizeServicePrice mengosongkan harga maks selain Rentang', () => {
    expect(
      normalizeServicePrice({ price_type: 'fixed', price_min: 1, price_max: 5 }).price_max,
    ).toBeNull();
    expect(
      normalizeServicePrice({ price_type: 'range', price_min: 1, price_max: 5 }).price_max,
    ).toBe(5);
  });
});

describe('PATCH layanan', () => {
  it('hanya field yang dikirim; null mengosongkan harga maks', () => {
    expect(servicePatchSchema.parse({ price_type: 'start_from' })).toEqual({
      price_type: 'start_from',
    });
    expect(servicePatchSchema.parse({ price_max: null })).toEqual({ price_max: null });
    expect(servicePatchSchema.parse({ is_active: false })).toEqual({ is_active: false });
  });

  it('menolak body kosong dan field asing (slug, sort_order)', () => {
    expect(errorsOf(servicePatchSchema, {})._).toBe('Tidak ada perubahan yang dikirim.');
    expect(servicePatchSchema.safeParse({ slug: 'x' }).success).toBe(false);
    expect(servicePatchSchema.safeParse({ sort_order: 1 }).success).toBe(false);
  });

  it('harga min tidak boleh dikosongkan', () => {
    expect(errorsOf(servicePatchSchema, { price_min: '' }).price_min).toContain('wajib');
  });
});

describe('ketersediaan per cabang', () => {
  it('item: status wajib dikenal; harga khusus opsional dan dinormalisasi', () => {
    expect(availabilityItemSchema.parse({ service_id: ID, status: 'soon' })).toEqual({
      service_id: ID,
      status: 'soon',
      price_override_min: null,
      price_override_max: null,
    });
    const withPrice = availabilityItemSchema.parse({
      service_id: ID,
      status: 'available',
      price_override_min: '85K',
      price_override_max: 100000,
    });
    expect(withPrice).toMatchObject({ price_override_min: 85000, price_override_max: 100000 });
    expect(errorsOf(availabilityItemSchema, { service_id: ID, status: 'buka' }).status).toBe(
      'Status tidak dikenal.',
    );
    expect(errorsOf(availabilityItemSchema, { service_id: 'x', status: 'soon' }).service_id).toBe(
      'ID layanan tidak valid.',
    );
  });

  it('harga khusus: maks butuh min dan harus lebih besar', () => {
    expect(checkOverride(null, null)).toEqual({});
    expect(checkOverride(85000, null)).toEqual({});
    expect(checkOverride(null, 100000)).toHaveProperty('price_override_min');
    expect(checkOverride(100000, 100000)).toHaveProperty('price_override_max');
    expect(checkOverride(85000, 100000)).toEqual({});
    expect(
      errorsOf(availabilityItemSchema, {
        service_id: ID,
        status: 'available',
        price_override_min: 100000,
        price_override_max: 90000,
      }).price_override_max,
    ).toContain('lebih besar');
  });

  it('bulk: tidak kosong, tanpa layanan dobel, maks 100', () => {
    const a = { service_id: ID, status: 'available' };
    const b = { service_id: ID2, status: 'unavailable' };
    expect(availabilityBulkSchema.safeParse([a, b]).success).toBe(true);
    expect(availabilityBulkSchema.safeParse([]).success).toBe(false);
    expect(availabilityBulkSchema.safeParse([a, a]).success).toBe(false);
    expect(availabilityBulkSchema.safeParse({}).success).toBe(false);
  });

  it('terapkan ke semua: status wajib', () => {
    expect(applyAllSchema.safeParse({ status: 'soon' }).success).toBe(true);
    expect(applyAllSchema.safeParse({ status: 'x' }).success).toBe(false);
    expect(applyAllSchema.safeParse({}).success).toBe(false);
  });

  it('urut ulang layanan: menolak kosong, dobel, negatif', () => {
    expect(serviceReorderSchema.safeParse([{ id: ID, sort_order: 1 }]).success).toBe(true);
    expect(serviceReorderSchema.safeParse([]).success).toBe(false);
    expect(
      serviceReorderSchema.safeParse([
        { id: ID, sort_order: 1 },
        { id: ID, sort_order: 2 },
      ]).success,
    ).toBe(false);
    expect(serviceReorderSchema.safeParse([{ id: ID, sort_order: -1 }]).success).toBe(false);
  });
});

describe('tampilan layanan', () => {
  const item = (over: Partial<ServiceItem>): ServiceItem => ({
    id: over.name ?? 'x',
    slug: 'x',
    name: 'X',
    category: 'add_on',
    price_type: 'fixed',
    price_min: 20000,
    price_max: null,
    note: null,
    description: null,
    is_active: true,
    sort_order: 1,
    ...over,
  });

  it('teks harga per tipe', () => {
    expect(servicePriceText(item({}))).toBe('20K');
    expect(servicePriceText(item({ price_type: 'start_from', price_min: 350000 }))).toBe(
      'Mulai 350K',
    );
    expect(
      servicePriceText(item({ price_type: 'range', price_min: 150000, price_max: 300000 })),
    ).toBe('150K–300K');
    expect(overrideText(85000, null)).toBe('85K');
    expect(overrideText(85000, 100000)).toBe('85K–100K');
    expect(overrideText(null, null)).toBeNull();
  });

  it('kelompok per kategori berurutan tetap, item urut sort_order, kategori kosong dibuang', () => {
    const groups = groupByCategory([
      item({ name: 'Perming', category: 'hair_treatment', sort_order: 2 }),
      item({ name: 'Trim', category: 'add_on', sort_order: 1 }),
      item({ name: 'Styling', category: 'hair_treatment', sort_order: 1 }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Add-ons', 'Hair Treatment']);
    expect(groups[1]!.items.map((i) => i.name)).toEqual(['Styling', 'Perming']);
  });

  it('nilai form dari layanan, dan peta ketersediaan', () => {
    const form = toServiceForm(
      item({
        name: 'Down Perm',
        price_type: 'range',
        price_min: 150000,
        price_max: 300000,
        note: 'a',
      }),
    );
    expect(form).toMatchObject({
      price_min: '150K',
      price_max: '300K',
      note: 'a',
      description: '',
    });
    expect(serviceCreateSchema.safeParse(form).success).toBe(true);

    const row: BranchServiceRow = {
      branch_id: 'b1',
      service_id: 's1',
      status: 'soon',
      price_override_min: null,
      price_override_max: null,
      updated_at: '2026-11-07T00:00:00Z',
    };
    expect(availabilityMap([row]).get('b1:s1')).toBe(row);
    expect(availabilityMap([row]).get('b1:s2')).toBeUndefined();
  });
});
