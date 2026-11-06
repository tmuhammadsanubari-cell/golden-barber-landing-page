import { describe, expect, it } from 'vitest';
import { getBarbers, getBranches, getFaqs, getSettings } from '@/lib/data';
import {
  branchDescription,
  branchTitle,
  buildFaqJsonLd,
  buildHairSalonJsonLd,
  buildOrganizationJsonLd,
  cityShort,
  DESCRIPTION_MAX,
  priceRangeOf,
  serializeJsonLd,
  streetOf,
  TITLE_MAX,
  truncate,
} from '@/lib/seo';

const siteUrl = 'https://goldenbarber.example';

describe('helper teks SEO', () => {
  it('streetOf membuang nomor dan lantai', () => {
    expect(streetOf('Jl. Ir. H. Juanda No.294A')).toBe('Jl. Ir. H. Juanda');
    expect(streetOf('Jl. Dipatiukur No.57B2 Lt.1')).toBe('Jl. Dipatiukur');
    expect(streetOf('Ruko Valencia Arcade No. JC16')).toBe('Ruko Valencia Arcade');
    expect(streetOf('Cipaganti')).toBe('Cipaganti');
  });

  it('cityShort membuang awalan Kota/Kab.', () => {
    expect(cityShort('Kota Bandung')).toBe('Bandung');
    expect(cityShort('Kab. Tangerang')).toBe('Tangerang');
    expect(cityShort('Tangerang Selatan')).toBe('Tangerang Selatan');
  });

  it('truncate memotong di batas kata dan tidak melewati batas', () => {
    const text = 'satu dua tiga empat lima enam tujuh delapan';
    const out = truncate(text, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
    expect(truncate('pendek', 20)).toBe('pendek');
  });
});

describe('metadata cabang', () => {
  it('judul Dago memuat nama jalan dan tetap ≤ 60', async () => {
    const dago = (await getBranches()).find((b) => b.slug === 'dago')!;
    expect(branchTitle(dago)).toBe('Golden Barber Dago — Barbershop di Jl. Ir. H. Juanda');
  });

  it('semua cabang: title ≤ 60, description ≤ 160, dan unik', async () => {
    const branches = await getBranches();
    const titles = branches.map(branchTitle);
    for (const [index, branch] of branches.entries()) {
      expect(titles[index]!.length, branch.slug).toBeLessThanOrEqual(TITLE_MAX);
      expect(branchDescription(branch).length, branch.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
    expect(new Set(titles).size).toBe(branches.length);
  });

  it('seo_defaults beranda memenuhi batas F-08', async () => {
    const { seo_defaults: seo } = await getSettings();
    expect(seo.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(seo.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe('JSON-LD', () => {
  it('HairSalon Dago: field wajib F-08', async () => {
    const [branches, barbers, settings] = await Promise.all([
      getBranches(),
      getBarbers(),
      getSettings(),
    ]);
    const dago = branches.find((b) => b.slug === 'dago')!;
    const dagoBarbers = barbers.filter((b) => b.branch_slug === 'dago');
    const ld = buildHairSalonJsonLd(dago, dagoBarbers, { siteUrl, settings });
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'HairSalon',
      name: 'Golden Barber Dago',
      url: `${siteUrl}/cabang/dago/`,
      telephone: '+6281214807192',
      priceRange: 'Rp85.000–Rp130.000',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Jl. Ir. H. Juanda No.294A',
        addressLocality: 'Bandung',
        addressRegion: 'Jawa Barat',
        postalCode: '40135',
        addressCountry: 'ID',
      },
      sameAs: [settings.social_links.instagram],
    });
    expect(ld).toHaveProperty('openingHoursSpecification[0].opens', '08:00');
    expect(ld).toHaveProperty('openingHoursSpecification[0].closes', '23:00');
    expect(ld).toHaveProperty('openingHoursSpecification[0].dayOfWeek', [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(ld).not.toHaveProperty('aggregateRating');
    expect(ld).not.toHaveProperty('geo'); // koordinat belum ada: jangan karang
  });

  it('cabang tanpa barber: priceRange dihilangkan', async () => {
    const [branches, settings] = await Promise.all([getBranches(), getSettings()]);
    const citraRaya = branches.find((b) => b.slug === 'citra-raya')!;
    const ld = buildHairSalonJsonLd(citraRaya, [], { siteUrl, settings });
    expect(ld).not.toHaveProperty('priceRange');
    expect(priceRangeOf([])).toBeUndefined();
  });

  it('Organization beranda memuat 11 cabang di department', async () => {
    const [branches, barbers, settings] = await Promise.all([
      getBranches(),
      getBarbers(),
      getSettings(),
    ]);
    const ld = buildOrganizationJsonLd(branches, barbers, { siteUrl, settings });
    expect(ld).toMatchObject({ '@type': 'Organization', url: siteUrl });
    expect(ld).toHaveProperty('department.length', 11);
    expect(ld).toHaveProperty('department[0].@type', 'HairSalon');
    expect(JSON.stringify(ld.department)).not.toContain('@context');
  });

  it('FAQPage dari FAQ yang tampil', async () => {
    const faqs = await getFaqs();
    const ld = buildFaqJsonLd(faqs);
    expect(ld).toHaveProperty('@type', 'FAQPage');
    expect(ld).toHaveProperty('mainEntity.length', faqs.length);
    expect(ld).toHaveProperty('mainEntity[0].acceptedAnswer.text', faqs[0]!.answer);
  });

  it('serializeJsonLd meloloskan "<" agar tidak menutup tag script', () => {
    expect(serializeJsonLd({ a: '</script><b>' })).not.toContain('<');
  });
});
