import { describe, expect, it } from 'vitest';
import { attentionItems, joinNames, type BranchInfo } from '@/lib/admin/dashboard';

const branch = (id: string, name: string, over: Partial<BranchInfo> = {}): BranchInfo => ({
  id,
  name,
  region: 'bandung_raya',
  is_active: true,
  address_incomplete: false,
  ...over,
});

const base = {
  placeholderTestimonials: 0,
  placeholderGallery: 0,
  inactiveFaqs: 0,
};

describe('joinNames', () => {
  it('menggabungkan dengan "dan"', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A dan B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B, dan C');
  });
});

describe('attentionItems', () => {
  it('kosong bila semua beres', () => {
    const branches = [branch('1', 'Dago')];
    expect(attentionItems({ ...base, branches, activeBarbersByBranch: { '1': 3 } })).toEqual([]);
  });

  it('cabang aktif tanpa barber aktif → pricelist belum diisi; alamat tak lengkap terpisah', () => {
    const branches = [
      branch('1', 'Dago'),
      branch('2', 'Cihampelas', { address_incomplete: true }),
      branch('3', 'Citra Raya', { address_incomplete: true }),
    ];
    const items = attentionItems({ ...base, branches, activeBarbersByBranch: { '1': 9, '2': 4 } });
    expect(items).toEqual([
      { tag: 'Data', text: 'Pricelist Citra Raya belum diisi.' },
      { tag: 'Alamat', text: 'Alamat Cihampelas dan Citra Raya belum lengkap.' },
    ]);
  });

  it('cabang nonaktif diabaikan', () => {
    const branches = [branch('1', 'Lama', { is_active: false, address_incomplete: true })];
    expect(attentionItems({ ...base, branches, activeBarbersByBranch: {} })).toEqual([]);
  });

  it('konten placeholder dan FAQ nonaktif dihitung', () => {
    const items = attentionItems({
      branches: [branch('1', 'Dago')],
      activeBarbersByBranch: { '1': 1 },
      placeholderTestimonials: 3,
      placeholderGallery: 8,
      inactiveFaqs: 2,
    });
    expect(items.map((item) => item.tag)).toEqual(['Konten', 'Konten', 'Konten']);
    expect(items[0]!.text).toContain('3 testimoni masih contoh');
    expect(items[1]!.text).toContain('8 foto galeri masih ilustrasi');
    expect(items[2]!.text).toContain('2 FAQ belum tayang');
  });
});
