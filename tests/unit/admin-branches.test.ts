import { describe, expect, it } from 'vitest';
import {
  EMPTY_BRANCH,
  branchStatus,
  countByStatus,
  filterBranches,
  hhmm,
  moveItem,
  toFormValues,
  type BranchListItem,
  type BranchRow,
} from '@/lib/admin/branches';
import { slugify } from '@/lib/slug';
import { branchInputSchema, reorderSchema } from '@/lib/validation/admin-branches';

const valid = {
  name: 'Citra Raya',
  slug: 'citra-raya',
  region: 'jabodetabek',
  address: 'Jl. Citra Raya Boulevard',
  district: '',
  city: 'Kab. Tangerang',
  province: 'Banten',
  postal_code: '',
  address_incomplete: true,
  maps_url: '',
  maps_embed_url: '',
  latitude: '',
  longitude: '',
  open_time: '08:00',
  close_time: '23:00',
  whatsapp_number: '',
  is_flagship: false,
  is_new: true,
  is_active: true,
  internal_note: '',
};

function errorsOf(input: unknown): Record<string, string> {
  const result = branchInputSchema.safeParse(input);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

describe('slugify', () => {
  it('huruf kecil, spasi jadi tanda hubung', () => {
    expect(slugify('Pasgar TKI 2')).toBe('pasgar-tki-2');
    expect(slugify('Ujung Berung')).toBe('ujung-berung');
  });

  it('menghapus diakritik dan simbol, merapikan tanda hubung', () => {
    expect(slugify('  Café  Ünik!! ')).toBe('cafe-unik');
    expect(slugify('A -- B')).toBe('a-b');
  });

  it('nama tanpa huruf/angka menghasilkan string kosong', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('skema cabang', () => {
  it('isian opsional yang kosong menjadi null', () => {
    const result = branchInputSchema.parse(valid);
    expect(result.district).toBeNull();
    expect(result.postal_code).toBeNull();
    expect(result.maps_url).toBeNull();
    expect(result.maps_embed_url).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.whatsapp_number).toBeNull();
    expect(result.internal_note).toBeNull();
  });

  it('jam tutup harus lebih besar dari jam buka', () => {
    expect(errorsOf({ ...valid, open_time: '10:00', close_time: '10:00' }).close_time).toBe(
      'Jam tutup harus lebih besar dari jam buka.',
    );
    expect(
      errorsOf({ ...valid, open_time: '10:00', close_time: '09:00' }).close_time,
    ).toBeDefined();
    expect(
      errorsOf({ ...valid, open_time: '08:00', close_time: '23:00' }).close_time,
    ).toBeUndefined();
  });

  it('slug hanya huruf kecil, angka, tanda hubung', () => {
    for (const bad of ['Citra Raya', 'citra_raya', '-citra', 'citra-', 'citra--raya', 'citrä']) {
      expect(errorsOf({ ...valid, slug: bad }).slug, bad).toContain('Slug hanya boleh');
    }
    expect(errorsOf({ ...valid, slug: 'pasgar-tki-2' }).slug).toBeUndefined();
  });

  it('URL embed harus dari Google Maps embed', () => {
    expect(
      errorsOf({ ...valid, maps_embed_url: 'https://maps.app.goo.gl/xxxx' }).maps_embed_url,
    ).toContain('https://www.google.com/maps/embed');
    expect(
      errorsOf({ ...valid, maps_embed_url: 'https://www.google.com/maps/embed?pb=!1m18' })
        .maps_embed_url,
    ).toBeUndefined();
  });

  it('URL Google Maps harus https', () => {
    expect(errorsOf({ ...valid, maps_url: 'http://maps.app.goo.gl/x' }).maps_url).toBeDefined();
    expect(errorsOf({ ...valid, maps_url: 'bukan url' }).maps_url).toBeDefined();
    expect(errorsOf({ ...valid, maps_url: 'https://maps.app.goo.gl/x' }).maps_url).toBeUndefined();
  });

  it('nomor WA dinormalisasi ke 62…, salah format ditolak', () => {
    expect(
      branchInputSchema.parse({ ...valid, whatsapp_number: '0812-1480-7192' }).whatsapp_number,
    ).toBe('6281214807192');
    expect(errorsOf({ ...valid, whatsapp_number: '12345' }).whatsapp_number).toContain(
      'Nomor WhatsApp',
    );
  });

  it('kode pos 5 digit', () => {
    expect(errorsOf({ ...valid, postal_code: '4013' }).postal_code).toBe(
      'Kode pos harus 5 digit angka.',
    );
    expect(branchInputSchema.parse({ ...valid, postal_code: '40135' }).postal_code).toBe('40135');
  });

  it('latitude & longitude harus berpasangan dan dalam rentang', () => {
    expect(errorsOf({ ...valid, latitude: '-6.89', longitude: '' }).longitude).toContain(
      'bersamaan',
    );
    expect(errorsOf({ ...valid, latitude: '', longitude: '107.6' }).latitude).toContain(
      'bersamaan',
    );
    expect(errorsOf({ ...valid, latitude: '91', longitude: '107' }).latitude).toBeDefined();
    const ok = branchInputSchema.parse({ ...valid, latitude: '-6.8915', longitude: '107.6107' });
    expect(ok.latitude).toBe(-6.8915);
    expect(ok.longitude).toBe(107.6107);
  });

  it('nama dan alamat wajib', () => {
    const errors = errorsOf({ ...valid, name: '', address: ' ', city: '' });
    expect(errors.name).toBeDefined();
    expect(errors.address).toBeDefined();
    expect(errors.city).toBeDefined();
  });

  it('wilayah di luar enum ditolak', () => {
    expect(errorsOf({ ...valid, region: 'bali' }).region).toBe('Pilih wilayah.');
  });
});

describe('skema urutan', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';

  it('menerima daftar { id, sort_order }', () => {
    expect(
      reorderSchema.safeParse([
        { id: a, sort_order: 1 },
        { id: b, sort_order: 2 },
      ]).success,
    ).toBe(true);
  });

  it('menolak kosong, id dobel, id bukan uuid, sort_order negatif', () => {
    expect(reorderSchema.safeParse([]).success).toBe(false);
    expect(
      reorderSchema.safeParse([
        { id: a, sort_order: 1 },
        { id: a, sort_order: 2 },
      ]).success,
    ).toBe(false);
    expect(reorderSchema.safeParse([{ id: 'x', sort_order: 1 }]).success).toBe(false);
    expect(reorderSchema.safeParse([{ id: a, sort_order: -1 }]).success).toBe(false);
    expect(reorderSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('daftar cabang', () => {
  const item = (over: Partial<BranchListItem>): BranchListItem => ({
    id: over.name ?? 'x',
    slug: (over.name ?? 'x').toLowerCase(),
    name: 'X',
    region: 'bandung_raya',
    city: 'Kota Bandung',
    sort_order: 1,
    is_flagship: false,
    is_active: true,
    is_new: false,
    barbers: 0,
    ...over,
  });
  const items = [
    item({ name: 'Dipatiukur', is_flagship: true }),
    item({ name: 'Citra Raya', region: 'jabodetabek', city: 'Kab. Tangerang', is_new: true }),
    item({ name: 'Condet', region: 'jabodetabek', city: 'Jakarta Timur', is_active: false }),
    item({ name: 'Dago' }),
  ];

  it('status saling lepas: nonaktif menang atas baru', () => {
    expect(branchStatus({ is_active: true, is_new: false })).toBe('aktif');
    expect(branchStatus({ is_active: true, is_new: true })).toBe('baru');
    expect(branchStatus({ is_active: false, is_new: true })).toBe('nonaktif');
  });

  it('hitungan chip berjumlah total', () => {
    const counts = countByStatus(items);
    expect(counts).toEqual({ aktif: 2, baru: 1, nonaktif: 1 });
  });

  it('filter status dan pencarian (nama, kota, wilayah)', () => {
    expect(filterBranches(items, 'nonaktif', null).map((i) => i.name)).toEqual(['Condet']);
    expect(filterBranches(items, null, 'dago').map((i) => i.name)).toEqual(['Dago']);
    expect(filterBranches(items, null, 'tangerang').map((i) => i.name)).toEqual(['Citra Raya']);
    expect(filterBranches(items, null, 'jabodetabek')).toHaveLength(2);
    expect(filterBranches(items, 'baru', 'dago')).toHaveLength(0);
    expect(filterBranches(items, null, '  ')).toHaveLength(4);
  });

  it('moveItem memindahkan tanpa mengubah array asal, abaikan indeks di luar rentang', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 0, 4)).toBe(list);
    expect(moveItem(list, 2, 2)).toBe(list);
  });
});

describe('nilai form', () => {
  const row: BranchRow = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'dago',
    name: 'Dago',
    region: 'bandung_raya',
    address: 'Jl. Ir. H. Juanda No.294A',
    district: null,
    city: 'Kota Bandung',
    province: 'Jawa Barat',
    postal_code: '40135',
    address_incomplete: false,
    maps_url: null,
    maps_embed_url: null,
    latitude: -6.8915,
    longitude: null,
    open_time: '08:00:00',
    close_time: '23:00:00',
    whatsapp_number: '6281200000101',
    is_flagship: false,
    is_new: false,
    is_active: true,
    sort_order: 2,
    photo_path: null,
    photo_is_placeholder: true,
    internal_note: null,
    created_at: '2026-11-04T00:00:00Z',
    updated_at: '2026-11-04T00:00:00Z',
  };

  it('jam Postgres dipotong ke HH:MM', () => {
    expect(hhmm('08:00:00')).toBe('08:00');
    expect(toFormValues(row).open_time).toBe('08:00');
    expect(toFormValues(row).close_time).toBe('23:00');
  });

  it('null menjadi string kosong, nomor WA tampil format lokal', () => {
    const values = toFormValues(row);
    expect(values.district).toBe('');
    expect(values.maps_url).toBe('');
    expect(values.latitude).toBe('-6.8915');
    expect(values.longitude).toBe('');
    expect(values.whatsapp_number).toBe('0812-0000-0101');
  });

  it('nilai form hasil toFormValues lolos skema (bolak-balik aman)', () => {
    expect(
      branchInputSchema.safeParse({ ...toFormValues(row), latitude: '', longitude: '' }).success,
    ).toBe(true);
  });

  it('form kosong untuk cabang baru: default aman', () => {
    expect(EMPTY_BRANCH.open_time).toBe('08:00');
    expect(EMPTY_BRANCH.close_time).toBe('23:00');
    expect(EMPTY_BRANCH.is_flagship).toBe(false);
    expect(EMPTY_BRANCH.is_active).toBe(true);
  });
});
