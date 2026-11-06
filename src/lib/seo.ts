// SEO lokal (PRD F-08): title/description per cabang dan JSON-LD schema.org.
// Fungsi murni, tanpa akses jaringan; dipanggil saat build.
import { formatHours, formatRupiah } from '@/lib/format';
import { formatAddress } from '@/lib/maps';
import { normalizePhone } from '@/lib/whatsapp';
import type { Barber, Branch, Faq, SiteSettings } from '@/types/content';

export const SITE_NAME = 'Golden Barber Indonesia';
export const TITLE_MAX = 60; // PRD F-08
export const DESCRIPTION_MAX = 160; // PRD F-08

const WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** "Jl. Ir. H. Juanda No.294A" → "Jl. Ir. H. Juanda". Tanpa nomor: apa adanya. */
export function streetOf(address: string): string {
  return address.replace(/\s+(No\.?|Lt\.?)\s*[\w-]+.*$/i, '').trim();
}

/** "Kota Bandung" → "Bandung", "Kab. Tangerang" → "Tangerang". */
export function cityShort(city: string): string {
  return city.replace(/^(Kota|Kab\.|Kabupaten)\s+/i, '').trim();
}

/** Potong di batas kata, tambah "…" bila terpotong. Hasil selalu ≤ max. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Judul ≤ 60 karakter. Urutan pilihan: jalan + kota, jalan saja, kota saja.
 * Contoh PRD "…Jl. Ir. H. Juanda, Bandung" 61 karakter, jadi Dago jatuh ke pilihan "jalan saja"
 * (DECISIONS D-18).
 */
export function branchTitle(branch: Branch): string {
  const city = cityShort(branch.city);
  const street = streetOf(branch.address);
  const candidates = [
    `Golden Barber ${branch.name} — Barbershop di ${street}, ${city}`,
    `Golden Barber ${branch.name} — Barbershop di ${street}`,
    `Golden Barber ${branch.name} — Barbershop di ${city}`,
    `Golden Barber ${branch.name} — Barbershop ${city}`,
  ];
  return (
    candidates.find((title) => title.length <= TITLE_MAX) ?? truncate(candidates[3]!, TITLE_MAX)
  );
}

export function branchDescription(branch: Branch): string {
  const hours = formatHours(branch.open_time, branch.close_time);
  return truncate(
    `Golden Barber ${branch.name}, ${formatAddress(branch)}. Buka setiap hari ${hours}. Lihat harga per barber dan booking via WhatsApp.`,
    DESCRIPTION_MAX,
  );
}

type JsonLd = Record<string, unknown>;

export interface SeoContext {
  /** Origin situs tanpa garis miring akhir, mis. "https://goldenbarber.id". */
  siteUrl: string;
  settings: Pick<SiteSettings, 'whatsapp_number' | 'social_links' | 'seo_defaults'>;
}

/** Dengan garis miring akhir, sama dengan canonical dan sitemap (build format directory). */
export const branchUrl = (siteUrl: string, slug: string) => `${siteUrl}/cabang/${slug}/`;

/** "Rp85.000–Rp130.000" dari harga Haircut Reguler; kosong bila belum ada barber. */
export function priceRangeOf(barbers: Pick<Barber, 'haircut_price'>[]): string | undefined {
  if (barbers.length === 0) return undefined;
  const prices = barbers.map((barber) => barber.haircut_price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatRupiah(min) : `${formatRupiah(min)}–${formatRupiah(max)}`;
}

function salonNode(branch: Branch, barbers: Barber[], ctx: SeoContext): JsonLd {
  const { siteUrl, settings } = ctx;
  const priceRange = priceRangeOf(barbers);
  return {
    '@type': 'HairSalon',
    name: `Golden Barber ${branch.name}`,
    url: branchUrl(siteUrl, branch.slug),
    image: `${siteUrl}${settings.seo_defaults.og_image}`,
    telephone: `+${normalizePhone(branch.whatsapp_number ?? settings.whatsapp_number)}`,
    ...(priceRange ? { priceRange } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: branch.address,
      addressLocality: cityShort(branch.city),
      addressRegion: branch.province,
      ...(branch.postal_code ? { postalCode: branch.postal_code } : {}),
      addressCountry: 'ID',
    },
    ...(branch.latitude !== null && branch.longitude !== null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: branch.latitude,
            longitude: branch.longitude,
          },
        }
      : {}),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...WEEK],
        opens: branch.open_time,
        closes: branch.close_time,
      },
    ],
    sameAs: [settings.social_links.instagram],
  };
}

/** JSON-LD `HairSalon` untuk halaman cabang. `aggregateRating` sengaja tidak dicantumkan. */
export function buildHairSalonJsonLd(branch: Branch, barbers: Barber[], ctx: SeoContext): JsonLd {
  return { '@context': 'https://schema.org', ...salonNode(branch, barbers, ctx) };
}

/** JSON-LD `Organization` untuk beranda, `department` berisi seluruh cabang. */
export function buildOrganizationJsonLd(
  branches: Branch[],
  barbers: Barber[],
  ctx: SeoContext,
): JsonLd {
  const { siteUrl, settings } = ctx;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/brand/logo-golden-barber.png`,
    sameAs: [settings.social_links.instagram, settings.social_links.threads],
    department: branches.map((branch) =>
      salonNode(
        branch,
        barbers.filter((barber) => barber.branch_slug === branch.slug),
        ctx,
      ),
    ),
  };
}

export function buildFaqJsonLd(faqs: Pick<Faq, 'question' | 'answer'>[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

/** Serialisasi aman untuk dimasukkan ke <script type="application/ld+json">. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}
