-- DIBUAT OTOMATIS oleh scripts/build-seed-sql.ts dari src/data/seed/*.json.
-- Jangan edit manual. Ubah JSON, lalu jalankan: npm run seed:build
--
-- Aman dijalankan ulang: tidak menimpa data yang sudah ada.

begin;

-- Trigger auto-isi branch_services dimatikan sementara: seed mengisi ke-154 baris
-- ketersediaan secara eksplisit (A.4).
alter table public.branches disable trigger fill_branch_services;
alter table public.services disable trigger fill_branch_services;

-- Cabang (11)
insert into public.branches (slug, name, region, address, district, city, province, postal_code, address_incomplete, maps_url, maps_embed_url, latitude, longitude, open_time, close_time, whatsapp_number, is_flagship, is_new, is_active, sort_order, photo_path, photo_is_placeholder)
values
  ('dipatiukur', 'Dipatiukur', 'bandung_raya'::public.region_type, 'Jl. Dipatiukur No.57B2 Lt.1', 'Lebakgede, Kec. Coblong', 'Kota Bandung', 'Jawa Barat', '40132', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, true, false, true, 1, '/images/dummy/cabang.webp', true),
  ('dago', 'Dago', 'bandung_raya'::public.region_type, 'Jl. Ir. H. Juanda No.294A', 'Dago', 'Kota Bandung', 'Jawa Barat', '40135', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 2, '/images/dummy/cabang.webp', true),
  ('cihampelas', 'Cihampelas', 'bandung_raya'::public.region_type, 'Cipaganti', 'Kec. Coblong', 'Kota Bandung', 'Jawa Barat', '40131', true, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 3, '/images/dummy/cabang.webp', true),
  ('podomoro', 'Podomoro', 'bandung_raya'::public.region_type, 'Jl. Raya Bojongsoang No.183', null, 'Kab. Bandung', 'Jawa Barat', '40287', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 4, '/images/dummy/cabang.webp', true),
  ('pasgar-tki-2', 'Pasgar TKI 2', 'bandung_raya'::public.region_type, 'Ruko Pasar RB15, Jl. Raya Taman Kopo Indah 2', 'Rahayu', 'Kab. Bandung', 'Jawa Barat', '40226', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 5, '/images/dummy/cabang.webp', true),
  ('ujung-berung', 'Ujung Berung', 'bandung_raya'::public.region_type, 'Jl. AH. Nasution No.111A', 'Kec. Ujung Berung', 'Kota Bandung', 'Jawa Barat', '40611', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 6, '/images/dummy/cabang.webp', true),
  ('peta', 'Peta', 'bandung_raya'::public.region_type, 'Jl. Peta No.232', 'Suka Asih, Kec. Bojongloa Kaler', 'Kota Bandung', 'Jawa Barat', '40231', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 7, '/images/dummy/cabang.webp', true),
  ('karawaci', 'Karawaci', 'jabodetabek'::public.region_type, 'Ruko Little Asia 828', 'Binong', 'Kab. Tangerang', 'Banten', '15810', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 8, '/images/dummy/cabang.webp', true),
  ('citra-raya', 'Citra Raya', 'jabodetabek'::public.region_type, 'Kawasan Citra Raya', null, 'Kab. Tangerang', 'Banten', null, true, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, true, true, 9, '/images/dummy/cabang.webp', true),
  ('graha-raya', 'Graha Raya', 'jabodetabek'::public.region_type, 'Ruko Valencia Arcade No. JC16', null, 'Tangerang Selatan', 'Banten', null, false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 10, '/images/dummy/cabang.webp', true),
  ('condet', 'Condet', 'jabodetabek'::public.region_type, 'Jl. Raya Condet No.30', 'Batu Ampar', 'Jakarta Timur', 'DKI Jakarta', '13530', false, null, null, null::numeric, null::numeric, '08:00'::time, '23:00'::time, null, false, false, true, 11, '/images/dummy/cabang.webp', true)
on conflict (slug) do nothing;

-- Layanan (14)
insert into public.services (slug, name, category, price_type, price_min, price_max, note, description, is_active, sort_order)
values
  ('trim', 'Trim', 'add_on'::public.service_category, 'fixed'::public.price_type, 20000, null::int, null, null, true, 1),
  ('shaver', 'Shaver', 'add_on'::public.service_category, 'fixed'::public.price_type, 25000, null::int, null, null, true, 2),
  ('razor', 'Razor', 'add_on'::public.service_category, 'fixed'::public.price_type, 40000, null::int, null, null, true, 3),
  ('shaving', 'Shaving', 'add_on'::public.service_category, 'fixed'::public.price_type, 65000, null::int, null, null, true, 4),
  ('basic-colour', 'Basic Colour', 'hair_colouring'::public.service_category, 'fixed'::public.price_type, 125000, null::int, 'Dark Brown', null, true, 1),
  ('peek-a-boo', 'Peek A Boo', 'hair_colouring'::public.service_category, 'start_from'::public.price_type, 350000, null::int, null, null, true, 2),
  ('highlight', 'Highlight', 'hair_colouring'::public.service_category, 'start_from'::public.price_type, 430000, null::int, null, null, true, 3),
  ('fashion-colour', 'Fashion Colour', 'hair_colouring'::public.service_category, 'start_from'::public.price_type, 580000, null::int, null, null, true, 4),
  ('creative-colour', 'Creative Colour', 'hair_colouring'::public.service_category, 'start_from'::public.price_type, 700000, null::int, null, null, true, 5),
  ('styling', 'Styling', 'hair_treatment'::public.service_category, 'fixed'::public.price_type, 35000, null::int, null, null, true, 1),
  ('creambath', 'Creambath', 'hair_treatment'::public.service_category, 'fixed'::public.price_type, 40000, null::int, null, null, true, 2),
  ('down-perm', 'Down Perm', 'hair_treatment'::public.service_category, 'range'::public.price_type, 150000, 300000::int, null, null, true, 3),
  ('perming', 'Perming', 'hair_treatment'::public.service_category, 'start_from'::public.price_type, 500000, null::int, null, null, true, 4),
  ('cornrow', 'Cornrow', 'hair_treatment'::public.service_category, 'fixed'::public.price_type, 500000, null::int, null, null, true, 5)
on conflict (slug) do nothing;

-- Ketersediaan layanan per cabang (154)
insert into public.branch_services (branch_id, service_id, status, price_override_min, price_override_max)
select b.id, s.id, v.status, v.price_override_min, v.price_override_max
from (values
  ('dipatiukur', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'peek-a-boo', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'highlight', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'fashion-colour', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'creative-colour', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'down-perm', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'perming', 'available'::public.availability_status, null::int, null::int),
  ('dipatiukur', 'cornrow', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'peek-a-boo', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'highlight', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'fashion-colour', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'creative-colour', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'down-perm', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'perming', 'available'::public.availability_status, null::int, null::int),
  ('dago', 'cornrow', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'peek-a-boo', 'soon'::public.availability_status, null::int, null::int),
  ('cihampelas', 'highlight', 'soon'::public.availability_status, null::int, null::int),
  ('cihampelas', 'fashion-colour', 'soon'::public.availability_status, null::int, null::int),
  ('cihampelas', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('cihampelas', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('cihampelas', 'down-perm', 'soon'::public.availability_status, null::int, null::int),
  ('cihampelas', 'perming', 'soon'::public.availability_status, null::int, null::int),
  ('cihampelas', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('podomoro', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'peek-a-boo', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'highlight', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'fashion-colour', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('podomoro', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'down-perm', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'perming', 'available'::public.availability_status, null::int, null::int),
  ('podomoro', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'peek-a-boo', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'highlight', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'fashion-colour', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'down-perm', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'perming', 'available'::public.availability_status, null::int, null::int),
  ('pasgar-tki-2', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'peek-a-boo', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'highlight', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'fashion-colour', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'down-perm', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'perming', 'available'::public.availability_status, null::int, null::int),
  ('ujung-berung', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('peta', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'peek-a-boo', 'soon'::public.availability_status, null::int, null::int),
  ('peta', 'highlight', 'soon'::public.availability_status, null::int, null::int),
  ('peta', 'fashion-colour', 'soon'::public.availability_status, null::int, null::int),
  ('peta', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('peta', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('peta', 'down-perm', 'soon'::public.availability_status, null::int, null::int),
  ('peta', 'perming', 'soon'::public.availability_status, null::int, null::int),
  ('peta', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('karawaci', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'peek-a-boo', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'highlight', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'fashion-colour', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('karawaci', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'down-perm', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'perming', 'available'::public.availability_status, null::int, null::int),
  ('karawaci', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'trim', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'shaver', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'razor', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'shaving', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'basic-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'peek-a-boo', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'highlight', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'fashion-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'styling', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'creambath', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'down-perm', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'perming', 'unavailable'::public.availability_status, null::int, null::int),
  ('citra-raya', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('graha-raya', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'peek-a-boo', 'soon'::public.availability_status, null::int, null::int),
  ('graha-raya', 'highlight', 'soon'::public.availability_status, null::int, null::int),
  ('graha-raya', 'fashion-colour', 'soon'::public.availability_status, null::int, null::int),
  ('graha-raya', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('graha-raya', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('graha-raya', 'down-perm', 'soon'::public.availability_status, null::int, null::int),
  ('graha-raya', 'perming', 'soon'::public.availability_status, null::int, null::int),
  ('graha-raya', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int),
  ('condet', 'trim', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'shaver', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'razor', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'shaving', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'basic-colour', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'peek-a-boo', 'soon'::public.availability_status, null::int, null::int),
  ('condet', 'highlight', 'soon'::public.availability_status, null::int, null::int),
  ('condet', 'fashion-colour', 'soon'::public.availability_status, null::int, null::int),
  ('condet', 'creative-colour', 'unavailable'::public.availability_status, null::int, null::int),
  ('condet', 'styling', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'creambath', 'available'::public.availability_status, null::int, null::int),
  ('condet', 'down-perm', 'soon'::public.availability_status, null::int, null::int),
  ('condet', 'perming', 'soon'::public.availability_status, null::int, null::int),
  ('condet', 'cornrow', 'unavailable'::public.availability_status, null::int, null::int)
) as v(branch_slug, service_slug, status, price_override_min, price_override_max)
join public.branches b on b.slug = v.branch_slug
join public.services s on s.slug = v.service_slug
on conflict (branch_id, service_id) do nothing;

alter table public.branches enable trigger fill_branch_services;
alter table public.services enable trigger fill_branch_services;

-- Barber & harga (65)
insert into public.barbers (
  branch_id, name, label, is_generic, haircut_price, haircut_original_price,
  long_trim_price, long_trim_original_price, is_active, sort_order
)
select b.id, v.name, v.label, v.is_generic, v.haircut_price, v.haircut_original_price,
       v.long_trim_price, v.long_trim_original_price, v.is_active, v.sort_order
from (values
  ('dipatiukur', 'Aditia', null, false, 130000::int, 150000::int, 150000::int, null::int, true, 1::int),
  ('dipatiukur', 'Den Fadli', null, false, 130000::int, null::int, 150000::int, null::int, true, 2::int),
  ('dipatiukur', 'Riko', null, false, 130000::int, null::int, 150000::int, null::int, true, 3::int),
  ('dipatiukur', 'Alen', null, false, 130000::int, null::int, 150000::int, null::int, true, 4::int),
  ('dipatiukur', 'Zalva', null, false, 130000::int, null::int, 150000::int, null::int, true, 5::int),
  ('dipatiukur', 'Gery', null, false, 130000::int, null::int, 150000::int, null::int, true, 6::int),
  ('dipatiukur', 'Ardi', null, false, 110000::int, null::int, 125000::int, null::int, true, 7::int),
  ('dipatiukur', 'Ken', null, false, 110000::int, null::int, 125000::int, null::int, true, 8::int),
  ('dipatiukur', 'Frendy', null, false, 110000::int, null::int, 125000::int, null::int, true, 9::int),
  ('dipatiukur', 'Riki', null, false, 100000::int, null::int, 115000::int, null::int, true, 10::int),
  ('dipatiukur', 'Topan', null, false, 100000::int, null::int, 115000::int, null::int, true, 11::int),
  ('dipatiukur', 'Bayu', null, false, 100000::int, null::int, 115000::int, null::int, true, 12::int),
  ('dipatiukur', 'Nursalam', null, false, 85000::int, null::int, 100000::int, null::int, true, 13::int),
  ('dipatiukur', 'Galih', null, false, 85000::int, null::int, 100000::int, null::int, true, 14::int),
  ('dipatiukur', 'By Barber', null, true, 85000::int, null::int, 100000::int, null::int, true, 15::int),
  ('dago', 'Prayoga', null, false, 130000::int, 150000::int, 150000::int, null::int, true, 1::int),
  ('dago', 'Fauzi', null, false, 100000::int, null::int, 115000::int, null::int, true, 2::int),
  ('dago', 'Rian', null, false, 100000::int, null::int, 115000::int, null::int, true, 3::int),
  ('dago', 'Dadan', null, false, 100000::int, null::int, 115000::int, null::int, true, 4::int),
  ('dago', 'Rezky', null, false, 85000::int, null::int, 100000::int, null::int, true, 5::int),
  ('dago', 'Farrel', null, false, 85000::int, null::int, 100000::int, null::int, true, 6::int),
  ('dago', 'Epul', null, false, 85000::int, null::int, 100000::int, null::int, true, 7::int),
  ('dago', 'By Barber', 'tier 1', true, 100000::int, null::int, 115000::int, null::int, true, 8::int),
  ('dago', 'By Barber', 'tier 2', true, 85000::int, null::int, 100000::int, null::int, true, 9::int),
  ('cihampelas', 'Fajri', null, false, 85000::int, null::int, 100000::int, null::int, true, 1::int),
  ('podomoro', 'Bagus', null, false, 85000::int, null::int, 100000::int, null::int, true, 1::int),
  ('podomoro', 'Anton', null, false, 85000::int, null::int, 100000::int, null::int, true, 2::int),
  ('podomoro', 'Rivan', null, false, 85000::int, null::int, 100000::int, null::int, true, 3::int),
  ('podomoro', 'Rizan', null, false, 75000::int, null::int, 90000::int, null::int, true, 4::int),
  ('podomoro', 'Gusti', null, false, 75000::int, null::int, 90000::int, null::int, true, 5::int),
  ('podomoro', 'Teja', null, false, 75000::int, null::int, 90000::int, null::int, true, 6::int),
  ('podomoro', 'Abay', null, false, 65000::int, null::int, 80000::int, null::int, true, 7::int),
  ('podomoro', 'By Barber', null, true, 65000::int, null::int, 80000::int, null::int, true, 8::int),
  ('pasgar-tki-2', 'Juni', null, false, 85000::int, null::int, 100000::int, null::int, true, 1::int),
  ('pasgar-tki-2', 'Anas', null, false, 85000::int, null::int, 85000::int, null::int, true, 2::int),
  ('pasgar-tki-2', 'Agus', null, false, 75000::int, null::int, 75000::int, null::int, true, 3::int),
  ('pasgar-tki-2', 'Hendra', null, false, 60000::int, null::int, 60000::int, null::int, true, 4::int),
  ('pasgar-tki-2', 'By Barber', 'tier 1', true, 85000::int, null::int, 85000::int, null::int, true, 5::int),
  ('pasgar-tki-2', 'By Barber', 'tier 2', true, 60000::int, null::int, 60000::int, null::int, true, 6::int),
  ('ujung-berung', 'Iki', null, false, 75000::int, null::int, 90000::int, null::int, true, 1::int),
  ('ujung-berung', 'Risky', null, false, 75000::int, null::int, 90000::int, null::int, true, 2::int),
  ('ujung-berung', 'Ilham', null, false, 75000::int, null::int, 90000::int, null::int, true, 3::int),
  ('ujung-berung', 'Dafa', null, false, 75000::int, null::int, 90000::int, null::int, true, 4::int),
  ('ujung-berung', 'Krisna', null, false, 75000::int, null::int, 90000::int, null::int, true, 5::int),
  ('ujung-berung', 'By Barber', null, true, 70000::int, null::int, 85000::int, null::int, true, 6::int),
  ('peta', 'Rifky', null, false, 50000::int, null::int, 65000::int, null::int, true, 1::int),
  ('karawaci', 'Zalva', null, false, 85000::int, null::int, 100000::int, null::int, true, 1::int),
  ('karawaci', 'Puji', null, false, 75000::int, null::int, 90000::int, null::int, true, 2::int),
  ('karawaci', 'Wandi', null, false, 75000::int, null::int, 90000::int, null::int, true, 3::int),
  ('karawaci', 'Toni', null, false, 75000::int, null::int, 90000::int, null::int, true, 4::int),
  ('karawaci', 'Farid', null, false, 75000::int, null::int, 90000::int, null::int, true, 5::int),
  ('karawaci', 'Yoga', null, false, 75000::int, null::int, 90000::int, null::int, true, 6::int),
  ('karawaci', 'Fajri', null, false, 75000::int, null::int, 90000::int, null::int, true, 7::int),
  ('graha-raya', 'Faizal', null, false, 70000::int, null::int, 85000::int, null::int, true, 1::int),
  ('graha-raya', 'Dimas', null, false, 70000::int, null::int, 85000::int, null::int, true, 2::int),
  ('graha-raya', 'Restu', null, false, 70000::int, null::int, 85000::int, null::int, true, 3::int),
  ('graha-raya', 'Ifdal', null, false, 70000::int, null::int, 85000::int, null::int, true, 4::int),
  ('graha-raya', 'Pirgi', null, false, 70000::int, null::int, 85000::int, null::int, true, 5::int),
  ('graha-raya', 'By Barber', null, true, 70000::int, null::int, 85000::int, null::int, true, 6::int),
  ('condet', 'Deva', null, false, 70000::int, null::int, 85000::int, null::int, true, 1::int),
  ('condet', 'Miko', null, false, 70000::int, null::int, 85000::int, null::int, true, 2::int),
  ('condet', 'Faiz', null, false, 70000::int, null::int, 85000::int, null::int, true, 3::int),
  ('condet', 'Rafif', null, false, 70000::int, null::int, 85000::int, null::int, true, 4::int),
  ('condet', 'Fauzan', null, false, 70000::int, null::int, 85000::int, null::int, true, 5::int),
  ('condet', 'By Barber', null, true, 70000::int, null::int, 85000::int, null::int, true, 6::int)
) as v(branch_slug, name, label, is_generic, haircut_price, haircut_original_price,
       long_trim_price, long_trim_original_price, is_active, sort_order)
join public.branches b on b.slug = v.branch_slug
where not exists (
  select 1 from public.barbers x
  where x.branch_id = b.id and x.name = v.name and x.label is not distinct from v.label
);

-- FAQ (8)
insert into public.faqs (question, answer, is_active, sort_order)
select v.question, v.answer, v.is_active, v.sort_order
from (values
  ('Jam buka Golden Barber?', 'Semua cabang buka setiap hari pukul 08.00–23.00 WIB.', true, 1::int),
  ('Bagaimana cara booking?', 'Klik tombol "Booking via WhatsApp", pilih cabang dan barber, lalu admin akan mengonfirmasi slot.', true, 2::int),
  ('Apa yang sudah termasuk dalam harga haircut?', 'Konsultasi, hairwash 1–2x, pengaplikasian produk jika perlu, dan hair styling.', true, 3::int),
  ('Apa itu "By Barber"?', 'Anda akan dilayani barber yang sedang tersedia saat itu.', true, 4::int),
  ('Kenapa harga tiap barber berbeda?', 'Harga menyesuaikan pengalaman dan tingkat keahlian masing-masing barber.', true, 5::int),
  ('Apa arti "Segera Hadir" pada layanan?', 'Layanan tersebut sedang disiapkan di cabang itu dan belum bisa dipesan.', true, 6::int),
  ('Apakah bisa datang tanpa booking (walk-in)?', 'MENUNGGU KONFIRMASI PEMILIK', false, 7::int),
  ('Metode pembayaran apa saja yang diterima?', 'MENUNGGU KONFIRMASI PEMILIK', false, 8::int)
) as v(question, answer, is_active, sort_order)
where not exists (select 1 from public.faqs x where x.question = v.question);

-- Galeri (8)
insert into public.gallery_items (title, description, image_path, alt_text, is_placeholder, is_active, sort_order)
select v.title, v.description, v.image_path, v.alt_text, v.is_placeholder, v.is_active, v.sort_order
from (values
  ('Messy Fringe w/ Korean Taper', 'Poni bertekstur natural dengan gradasi Korean Taper di samping.', '/images/dummy/galeri-1.webp', 'Contoh model rambut Messy Fringe w/ Korean Taper', true, true, 1::int),
  ('French Crop', 'Poni pendek lurus dengan sisi tipis, rapi dan mudah diatur.', '/images/dummy/galeri-2.webp', 'Contoh model rambut French Crop', true, true, 2::int),
  ('Two Block', 'Bagian atas panjang, sisi dan belakang dipotong pendek.', '/images/dummy/galeri-3.webp', 'Contoh model rambut Two Block', true, true, 3::int),
  ('Comma Hair', 'Poni melengkung seperti tanda koma, khas gaya Korea.', '/images/dummy/galeri-4.webp', 'Contoh model rambut Comma Hair', true, true, 4::int),
  ('Buzz Cut', 'Potongan sangat pendek merata, praktis untuk cuaca panas.', '/images/dummy/galeri-5.webp', 'Contoh model rambut Buzz Cut', true, true, 5::int),
  ('Mullet', 'Depan dan samping pendek, belakang dibiarkan lebih panjang.', '/images/dummy/galeri-6.webp', 'Contoh model rambut Mullet', true, true, 6::int),
  ('Side Part', 'Belahan samping klasik dengan tampilan rapi.', '/images/dummy/galeri-7.webp', 'Contoh model rambut Side Part', true, true, 7::int),
  ('Textured Crop', 'Atas bertekstur dengan fade di samping.', '/images/dummy/galeri-8.webp', 'Contoh model rambut Textured Crop', true, true, 8::int)
) as v(title, description, image_path, alt_text, is_placeholder, is_active, sort_order)
where not exists (select 1 from public.gallery_items x where x.title = v.title);

-- Testimoni (3)
insert into public.testimonials (branch_id, customer_name, rating, content, source, is_placeholder, is_active, sort_order)
select b.id, v.customer_name, v.rating, v.content, v.source, v.is_placeholder, v.is_active, v.sort_order
from (values
  ('dipatiukur', 'Contoh Pelanggan A.', 5::smallint, 'CONTOH KONTEN — ganti dengan ulasan asli sebelum launch.', 'langsung', true, true, 1::int),
  ('dago', 'Contoh Pelanggan B.', 5::smallint, 'CONTOH KONTEN — ganti dengan ulasan asli sebelum launch.', 'langsung', true, true, 2::int),
  ('karawaci', 'Contoh Pelanggan C.', 5::smallint, 'CONTOH KONTEN — ganti dengan ulasan asli sebelum launch.', 'langsung', true, true, 3::int)
) as v(branch_slug, customer_name, rating, content, source, is_placeholder, is_active, sort_order)
left join public.branches b on b.slug = v.branch_slug
where not exists (
  select 1 from public.testimonials x
  where x.customer_name = v.customer_name and x.branch_id is not distinct from b.id
);

-- Pengaturan situs (11 key)
insert into public.site_settings (key, value)
values
  ('hero', '{"title":"Choose Your Haircut. The Winner''s Cut.","subtitle":"Berawal dari Dipatiukur, Bandung — kini hadir di 11 cabang di Bandung Raya & Jabodetabek. Buka setiap hari 08.00–23.00.","primary_cta":"Booking via WhatsApp","secondary_cta":"Cari Cabang Terdekat","image_path":"/images/dummy/hero.webp","image_is_placeholder":true}'::jsonb),
  ('whatsapp_number', '"6281214807192"'::jsonb),
  ('whatsapp_templates', '{"general":"Halo Golden Barber, saya mau booking potong rambut. Cabang yang tersedia di dekat saya apa saja ya?","branch":"Halo Golden Barber {nama_cabang}, saya mau booking potong rambut. Apakah ada slot hari ini?","barber":"Halo Golden Barber {nama_cabang}, saya mau booking {layanan} dengan barber {nama_barber} ({harga}). Kapan slot yang tersedia?","service":"Halo Golden Barber, saya mau tanya layanan {nama_layanan} di cabang {nama_cabang}.","branch_no_pricelist":"Halo Golden Barber {nama_cabang}, boleh minta info pricelist dan alamat lengkap cabang ini?","academy":"Halo Golden Academy, saya {nama} baru saja mengisi form minat di website. Saya ingin info kelas.","partnership":"Halo Golden Barber, saya {nama} baru saja mengisi form kemitraan di website. Saya ingin info kemitraan."}'::jsonb),
  ('social_links', '{"instagram":"https://www.instagram.com/goldenbarber_id/","threads":"https://www.threads.com/@goldenbarber_id","linktree":"https://linktr.ee/Goldenbarberindonesia","academy_instagram":"https://www.instagram.com/goldenacademybandung/"}'::jsonb),
  ('google_rating', '{"rating":4.9,"review_count":3340,"scope":"Cabang Dipatiukur","updated_at":"2026-11-01"}'::jsonb),
  ('about_highlights', '[{"icon":"message-circle","title":"Konsultasi Gratis","description":"Setiap potongan diawali konsultasi gaya rambut sesuai bentuk wajah."},{"icon":"droplets","title":"Hairwash & Styling Termasuk","description":"Harga haircut sudah termasuk hairwash 1–2x dan hair styling."},{"icon":"clock","title":"Buka Sampai Malam","description":"Semua cabang buka setiap hari pukul 08.00–23.00."},{"icon":"users","title":"Pilih Barbermu","description":"Harga transparan per barber — pilih sesuai gaya dan budget."},{"icon":"trophy","title":"Dipercaya Pemain Persib","description":"Pernah diliput sebagai barbershop langganan pemain Persib Bandung."},{"icon":"heart-handshake","title":"Peduli Sesama","description":"Pernah menggelar program cukur gratis untuk 1.134 orang."}]'::jsonb),
  ('haircut_includes', '["Konsultasi","Hairwash 1–2x","Pengaplikasian produk jika perlu","Hair Styling"]'::jsonb),
  ('academy_section', '{"title":"Golden Academy — Tempat Belajar Nyukur","description":"Ingin jadi barber profesional? Golden Academy membuka kesempatan belajar mencukur langsung dari tim Golden Barber. Isi form minat dan tim kami akan menghubungimu dengan info kelas terbaru.","is_details_available":false}'::jsonb),
  ('partnership_section', '{"title":"Buka Golden Barber di Kotamu","description":"Dari satu barbershop di Dipatiukur, Golden Barber kini hadir di 11 cabang di Bandung Raya dan Jabodetabek. Tertarik bermitra? Kirim minatmu dan tim manajemen akan menghubungi."}'::jsonb),
  ('media_mentions', '[{"title":"Ini Dia Barbershop Langganan Pemain Persib","outlet":"Bola.net","year":2016,"url":"https://www.bola.net/bolatainment/ini-dia-barbershop-langganan-pemain-persib-3ec520.html"}]'::jsonb),
  ('seo_defaults', '{"title":"Golden Barber — Barbershop di Bandung & Jabodetabek | 11 Cabang","description":"Golden Barber: barbershop asal Dipatiukur Bandung, kini 11 cabang. Lihat pricelist per barber dan booking langsung via WhatsApp. Buka setiap hari 08.00–23.00.","og_image":"/brand/og-default.jpg"}'::jsonb)
on conflict (key) do nothing;

commit;
