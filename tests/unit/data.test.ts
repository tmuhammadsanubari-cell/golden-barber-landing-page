import { describe, expect, it } from 'vitest';
import {
  getBarbersByBranch,
  getBranchServices,
  getBranches,
  getFaqs,
  getGallery,
  getServices,
  getTestimonials,
} from '@/lib/data';

describe('loader data seed', () => {
  it('11 cabang aktif urut sort_order: 7 Bandung Raya, 4 Jabodetabek', async () => {
    const branches = await getBranches();
    expect(branches).toHaveLength(11);
    expect(branches.map((b) => b.sort_order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(branches.filter((b) => b.region === 'bandung_raya')).toHaveLength(7);
    expect(branches.filter((b) => b.region === 'jabodetabek')).toHaveLength(4);
  });

  it('barber per cabang: Dipatiukur 15, Citra Raya kosong', async () => {
    expect(await getBarbersByBranch('dipatiukur')).toHaveLength(15);
    expect(await getBarbersByBranch('citra-raya')).toHaveLength(0);
  });

  it('matriks layanan 14 × 11', async () => {
    expect(await getServices()).toHaveLength(14);
    expect(await getBranchServices()).toHaveLength(154);
    expect(await getBranchServices('dago')).toHaveLength(14);
  });

  it('FAQ tanpa jawaban final tidak tampil', async () => {
    const faqs = await getFaqs();
    expect(faqs).toHaveLength(6);
    expect(faqs.some((f) => f.answer.includes('MENUNGGU'))).toBe(false);
  });

  it('galeri & testimoni aktif', async () => {
    expect(await getGallery()).toHaveLength(8);
    expect((await getTestimonials()).every((t) => t.is_placeholder)).toBe(true);
  });
});
