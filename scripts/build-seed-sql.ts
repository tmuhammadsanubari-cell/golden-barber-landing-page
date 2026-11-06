// Membuat supabase/seed.sql dari src/data/seed/*.json.
// Jalankan: npm run seed:build
// JSON adalah sumber data. Jangan edit seed.sql manual.
//
// Sifat seed: aman dijalankan ulang, tidak menimpa. Semua INSERT memakai
// "on conflict do nothing" / "where not exists", jadi suntingan admin tidak hilang.
// Relasi memakai slug yang diubah ke id lewat join.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Row = Record<string, unknown>;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSeed = (file: string): Row[] =>
  JSON.parse(readFileSync(resolve(root, 'src/data/seed', file), 'utf8')) as Row[];

/** Literal SQL. `type` dipakai agar NULL punya tipe jelas di dalam VALUES. */
function lit(value: unknown, type?: string): string {
  if (value === null || value === undefined) return type ? `null::${type}` : 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Angka tidak valid: ${value}`);
    return type ? `${value}::${type}` : String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const quoted = `'${text.replaceAll("'", "''")}'`;
  if (typeof value === 'object') return `${quoted}::jsonb`;
  return type ? `${quoted}::${type}` : quoted;
}

const values = (rows: Row[], columns: [name: string, type?: string][]): string =>
  rows
    .map((row) => `  (${columns.map(([name, type]) => lit(row[name], type)).join(', ')})`)
    .join(',\n');

const branches = readSeed('branches.json');
const services = readSeed('services.json');
const branchServices = readSeed('branch-services.json');
const barbers = readSeed('barbers.json');
const faqs = readSeed('faqs.json');
const gallery = readSeed('gallery.json');
const testimonials = readSeed('testimonials.json');
const settings = JSON.parse(
  readFileSync(resolve(root, 'src/data/seed/site-settings.json'), 'utf8'),
) as Row;

// Pemeriksaan relasi sebelum menulis SQL.
const branchSlugs = new Set(branches.map((b) => b.slug));
const serviceSlugs = new Set(services.map((s) => s.slug));
for (const row of barbers) {
  if (!branchSlugs.has(row.branch_slug)) throw new Error(`barber: cabang tidak ada: ${row.branch_slug}`);
}
for (const row of branchServices) {
  if (!branchSlugs.has(row.branch_slug)) throw new Error(`branch_services: cabang tidak ada: ${row.branch_slug}`);
  if (!serviceSlugs.has(row.service_slug)) throw new Error(`branch_services: layanan tidak ada: ${row.service_slug}`);
}
for (const row of testimonials) {
  if (row.branch_slug !== null && !branchSlugs.has(row.branch_slug)) {
    throw new Error(`testimonial: cabang tidak ada: ${row.branch_slug}`);
  }
}
const expected = branches.length * services.length;
if (branchServices.length !== expected) {
  throw new Error(`branch_services harus ${expected} baris (11 x 14), ada ${branchServices.length}`);
}

const branchColumns: [string, string?][] = [
  ['slug'], ['name'], ['region', 'public.region_type'], ['address'], ['district'], ['city'],
  ['province'], ['postal_code'], ['address_incomplete'], ['maps_url'], ['maps_embed_url'],
  ['latitude', 'numeric'], ['longitude', 'numeric'], ['open_time', 'time'], ['close_time', 'time'],
  ['whatsapp_number'], ['is_flagship'], ['is_new'], ['is_active'], ['sort_order'],
  ['photo_path'], ['photo_is_placeholder'],
];

const serviceColumns: [string, string?][] = [
  ['slug'], ['name'], ['category', 'public.service_category'], ['price_type', 'public.price_type'],
  ['price_min'], ['price_max', 'int'], ['note'], ['description'], ['is_active'], ['sort_order'],
];

const sql = `-- DIBUAT OTOMATIS oleh scripts/build-seed-sql.ts dari src/data/seed/*.json.
-- Jangan edit manual. Ubah JSON, lalu jalankan: npm run seed:build
--
-- Aman dijalankan ulang: tidak menimpa data yang sudah ada.

begin;

-- Trigger auto-isi branch_services dimatikan sementara: seed mengisi ke-154 baris
-- ketersediaan secara eksplisit (A.4).
alter table public.branches disable trigger fill_branch_services;
alter table public.services disable trigger fill_branch_services;

-- Cabang (${branches.length})
insert into public.branches (${branchColumns.map(([n]) => n).join(', ')})
values
${values(branches, branchColumns)}
on conflict (slug) do nothing;

-- Layanan (${services.length})
insert into public.services (${serviceColumns.map(([n]) => n).join(', ')})
values
${values(services, serviceColumns)}
on conflict (slug) do nothing;

-- Ketersediaan layanan per cabang (${branchServices.length})
insert into public.branch_services (branch_id, service_id, status, price_override_min, price_override_max)
select b.id, s.id, v.status, v.price_override_min, v.price_override_max
from (values
${values(branchServices, [
  ['branch_slug'], ['service_slug'], ['status', 'public.availability_status'],
  ['price_override_min', 'int'], ['price_override_max', 'int'],
])}
) as v(branch_slug, service_slug, status, price_override_min, price_override_max)
join public.branches b on b.slug = v.branch_slug
join public.services s on s.slug = v.service_slug
on conflict (branch_id, service_id) do nothing;

alter table public.branches enable trigger fill_branch_services;
alter table public.services enable trigger fill_branch_services;

-- Barber & harga (${barbers.length})
insert into public.barbers (
  branch_id, name, label, is_generic, haircut_price, haircut_original_price,
  long_trim_price, long_trim_original_price, is_active, sort_order
)
select b.id, v.name, v.label, v.is_generic, v.haircut_price, v.haircut_original_price,
       v.long_trim_price, v.long_trim_original_price, v.is_active, v.sort_order
from (values
${values(barbers, [
  ['branch_slug'], ['name'], ['label'], ['is_generic'], ['haircut_price', 'int'],
  ['haircut_original_price', 'int'], ['long_trim_price', 'int'],
  ['long_trim_original_price', 'int'], ['is_active'], ['sort_order', 'int'],
])}
) as v(branch_slug, name, label, is_generic, haircut_price, haircut_original_price,
       long_trim_price, long_trim_original_price, is_active, sort_order)
join public.branches b on b.slug = v.branch_slug
where not exists (
  select 1 from public.barbers x
  where x.branch_id = b.id and x.name = v.name and x.label is not distinct from v.label
);

-- FAQ (${faqs.length})
insert into public.faqs (question, answer, is_active, sort_order)
select v.question, v.answer, v.is_active, v.sort_order
from (values
${values(faqs, [['question'], ['answer'], ['is_active'], ['sort_order', 'int']])}
) as v(question, answer, is_active, sort_order)
where not exists (select 1 from public.faqs x where x.question = v.question);

-- Galeri (${gallery.length})
insert into public.gallery_items (title, description, image_path, alt_text, is_placeholder, is_active, sort_order)
select v.title, v.description, v.image_path, v.alt_text, v.is_placeholder, v.is_active, v.sort_order
from (values
${values(gallery, [
  ['title'], ['description'], ['image_path'], ['alt_text'], ['is_placeholder'], ['is_active'],
  ['sort_order', 'int'],
])}
) as v(title, description, image_path, alt_text, is_placeholder, is_active, sort_order)
where not exists (select 1 from public.gallery_items x where x.title = v.title);

-- Testimoni (${testimonials.length})
insert into public.testimonials (branch_id, customer_name, rating, content, source, is_placeholder, is_active, sort_order)
select b.id, v.customer_name, v.rating, v.content, v.source, v.is_placeholder, v.is_active, v.sort_order
from (values
${values(testimonials, [
  ['branch_slug'], ['customer_name'], ['rating', 'smallint'], ['content'], ['source'],
  ['is_placeholder'], ['is_active'], ['sort_order', 'int'],
])}
) as v(branch_slug, customer_name, rating, content, source, is_placeholder, is_active, sort_order)
left join public.branches b on b.slug = v.branch_slug
where not exists (
  select 1 from public.testimonials x
  where x.customer_name = v.customer_name and x.branch_id is not distinct from b.id
);

-- Pengaturan situs (${Object.keys(settings).length} key)
insert into public.site_settings (key, value)
values
${Object.entries(settings)
  .map(([key, value]) => `  (${lit(key)}, ${lit(JSON.stringify(value))}::jsonb)`)
  .join(',\n')}
on conflict (key) do nothing;

commit;
`;

const out = resolve(root, 'supabase/seed.sql');
writeFileSync(out, sql, 'utf8');
console.log(
  `seed.sql: ${branches.length} cabang, ${services.length} layanan, ${branchServices.length} ketersediaan, ` +
    `${barbers.length} barber, ${faqs.length} faq, ${gallery.length} galeri, ${testimonials.length} testimoni, ` +
    `${Object.keys(settings).length} setting`,
);
