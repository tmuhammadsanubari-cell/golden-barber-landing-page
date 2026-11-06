// Sumber data Supabase. Bentuk keluaran sama dengan json.ts (slug, bukan id).
// Dipanggil saat build dengan kunci anon, jadi RLS hanya meloloskan baris aktif.
import { getBuildClient } from '@/lib/supabase/build';
import type {
  Barber,
  Branch,
  BranchService,
  Faq,
  GalleryItem,
  Service,
  SiteSettings,
  Testimonial,
} from '@/types/content';
import { activeSorted, GALLERY_LIMIT, hasAnswer, TESTIMONIAL_LIMIT, type DataSource } from './common';

const SETTING_KEYS = [
  'hero',
  'whatsapp_number',
  'whatsapp_templates',
  'social_links',
  'google_rating',
  'about_highlights',
  'haircut_includes',
  'academy_section',
  'partnership_section',
  'media_mentions',
  'seo_defaults',
] as const;

// Kolom `id`, `created_at`, `updated_at`, `internal_note` tidak ikut ke situs publik.
const BRANCH_COLUMNS =
  'slug, name, region, address, district, city, province, postal_code, address_incomplete, maps_url, maps_embed_url, latitude, longitude, open_time, close_time, whatsapp_number, is_flagship, is_new, is_active, sort_order, photo_path, photo_is_placeholder';
const SERVICE_COLUMNS =
  'slug, name, category, price_type, price_min, price_max, note, description, is_active, sort_order';

type WithSlug<T> = T & { branches: { slug: string } | null };

/** Postgres mengembalikan TIME sebagai "08:00:00"; seed memakai "08:00". */
const hhmm = (time: string) => time.slice(0, 5);

function fail(table: string, message: string): never {
  throw new Error(`Supabase: gagal membaca ${table}: ${message}`);
}

async function select<T>(table: string, columns: string, order = 'sort_order'): Promise<T[]> {
  const query = getBuildClient().from(table).select(columns);
  const { data, error } = await (order ? query.order(order, { ascending: true }) : query);
  if (error) fail(table, error.message);
  return (data ?? []) as unknown as T[];
}

async function getBranches(): Promise<Branch[]> {
  const rows = await select<Branch>('branches', BRANCH_COLUMNS);
  return activeSorted(rows).map((row) => ({
    ...row,
    open_time: hhmm(row.open_time),
    close_time: hhmm(row.close_time),
  }));
}

async function getBarbers(): Promise<Barber[]> {
  const rows = await select<WithSlug<Omit<Barber, 'branch_slug'>>>(
    'barbers',
    'name, label, is_generic, haircut_price, haircut_original_price, long_trim_price, long_trim_original_price, is_active, sort_order, branches!inner(slug)',
  );
  return activeSorted(
    rows.map(({ branches, ...row }) => ({ ...row, branch_slug: branches?.slug ?? '' })),
  ).filter((row) => row.branch_slug !== '');
}

async function getServices(): Promise<Service[]> {
  return activeSorted(await select<Service>('services', SERVICE_COLUMNS));
}

async function getBranchServices(branchSlug?: string): Promise<BranchService[]> {
  const rows = await select<
    WithSlug<Omit<BranchService, 'branch_slug' | 'service_slug'>> & {
      services: { slug: string } | null;
    }
  >(
    'branch_services',
    'status, price_override_min, price_override_max, branches!inner(slug), services!inner(slug)',
    '',
  );
  const mapped = rows.flatMap(({ branches, services, ...row }) =>
    branches && services
      ? [{ ...row, branch_slug: branches.slug, service_slug: services.slug }]
      : [],
  );
  return branchSlug ? mapped.filter((row) => row.branch_slug === branchSlug) : mapped;
}

export const supabaseSource: DataSource = {
  getBranches,

  async getBranchBySlug(slug) {
    return (await getBranches()).find((branch) => branch.slug === slug) ?? null;
  },

  getBarbers,

  async getBarbersByBranch(branchSlug) {
    return (await getBarbers()).filter((barber) => barber.branch_slug === branchSlug);
  },

  getServices,
  getBranchServices,

  async getSettings() {
    const rows = await select<{ key: string; value: unknown }>('site_settings', 'key, value', 'key');
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const missing = SETTING_KEYS.filter((key) => !byKey.has(key));
    if (missing.length > 0) fail('site_settings', `key belum ada: ${missing.join(', ')}`);
    return Object.fromEntries(SETTING_KEYS.map((key) => [key, byKey.get(key)])) as unknown as SiteSettings;
  },

  async getFaqs() {
    return activeSorted(
      await select<Faq>('faqs', 'question, answer, is_active, sort_order'),
    ).filter(hasAnswer);
  },

  async getGallery() {
    const rows = await select<GalleryItem>(
      'gallery_items',
      'title, description, image_path, alt_text, is_placeholder, is_active, sort_order',
    );
    return activeSorted(rows).slice(0, GALLERY_LIMIT);
  },

  async getTestimonials() {
    const rows = await select<WithSlug<Omit<Testimonial, 'branch_slug'>>>(
      'testimonials',
      'customer_name, rating, content, source, is_placeholder, is_active, sort_order, branches(slug)',
    );
    return activeSorted(
      rows.map(({ branches, ...row }) => ({ ...row, branch_slug: branches?.slug ?? null })),
    ).slice(0, TESTIMONIAL_LIMIT);
  },
};
