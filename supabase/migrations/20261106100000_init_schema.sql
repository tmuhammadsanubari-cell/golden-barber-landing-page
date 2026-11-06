-- M2 — Skema awal Golden Barber (PRD 4.2).
-- Enum, 11 tabel, constraint, index. Trigger di migrasi berikutnya, RLS di migrasi setelahnya.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.region_type as enum ('bandung_raya', 'jabodetabek');
create type public.service_category as enum ('add_on', 'hair_colouring', 'hair_treatment');
create type public.price_type as enum ('fixed', 'start_from', 'range');
create type public.availability_status as enum ('available', 'soon', 'unavailable');
create type public.lead_type as enum ('academy', 'partnership');
create type public.lead_status as enum ('new', 'contacted', 'closed', 'spam');
create type public.admin_role as enum ('super_admin', 'editor');
create type public.publish_status as enum ('triggered', 'failed');

-- ---------------------------------------------------------------------------
-- admin_profiles (dibuat paling awal: dirujuk site_settings, leads, publish_logs)
-- ---------------------------------------------------------------------------
create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.admin_role not null default 'editor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  region public.region_type not null,
  address text not null,
  district text,
  city text not null,
  province text not null,
  postal_code varchar(5) check (postal_code ~ '^[0-9]{5}$'),
  address_incomplete boolean not null default false,
  maps_url text,
  maps_embed_url text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  open_time time not null default '08:00',
  close_time time not null default '23:00',
  whatsapp_number varchar(15),
  is_flagship boolean not null default false,
  is_new boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  photo_path text,
  photo_is_placeholder boolean not null default true,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_close_after_open check (close_time > open_time)
);

-- Maksimal satu cabang pusat.
create unique index branches_one_flagship on public.branches (is_flagship) where is_flagship;
create index branches_active_sort_idx on public.branches (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- barbers
-- ---------------------------------------------------------------------------
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  name text not null,
  label text,
  is_generic boolean not null default false,
  haircut_price int not null check (haircut_price between 10000 and 10000000),
  haircut_original_price int,
  long_trim_price int check (long_trim_price between 10000 and 10000000),
  long_trim_original_price int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbers_haircut_original_gt check (haircut_original_price is null or haircut_original_price > haircut_price),
  constraint barbers_long_trim_original_gt check (long_trim_original_price is null or long_trim_original_price > long_trim_price)
);

create index barbers_branch_active_sort_idx on public.barbers (branch_id, is_active, sort_order);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  category public.service_category not null,
  price_type public.price_type not null,
  price_min int not null check (price_min >= 0),
  price_max int,
  note text,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_range_max_gt_min check (price_type <> 'range' or price_max > price_min)
);

-- ---------------------------------------------------------------------------
-- branch_services
-- ---------------------------------------------------------------------------
create table public.branch_services (
  branch_id uuid not null references public.branches (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  status public.availability_status not null default 'unavailable',
  price_override_min int check (price_override_min >= 0),
  price_override_max int check (price_override_max >= 0),
  updated_at timestamptz not null default now(),
  primary key (branch_id, service_id)
);

create index branch_services_service_idx on public.branch_services (service_id);

-- ---------------------------------------------------------------------------
-- gallery_items
-- ---------------------------------------------------------------------------
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text check (char_length(description) <= 300),
  image_path text not null,
  alt_text text not null,
  is_placeholder boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- testimonials
-- ---------------------------------------------------------------------------
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches (id) on delete set null,
  customer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  content text not null check (char_length(content) <= 500),
  source text not null check (source in ('google', 'instagram', 'langsung')),
  is_placeholder boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index testimonials_branch_idx on public.testimonials (branch_id);

-- ---------------------------------------------------------------------------
-- faqs
-- ---------------------------------------------------------------------------
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- site_settings
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.admin_profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  type public.lead_type not null,
  full_name text not null,
  whatsapp_number varchar(15) not null check (whatsapp_number ~ '^62[0-9]{8,13}$'),
  city text not null,
  message text check (char_length(message) <= 1000),
  extra jsonb not null default '{}'::jsonb,
  consent boolean not null check (consent = true),
  status public.lead_status not null default 'new',
  admin_note text,
  handled_by uuid references public.admin_profiles (id) on delete set null,
  ip_hash char(64) not null,
  user_agent text,
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_type_status_created_idx on public.leads (type, status, created_at desc);
create index leads_ip_created_idx on public.leads (ip_hash, created_at);
create index leads_handled_by_idx on public.leads (handled_by);

-- ---------------------------------------------------------------------------
-- publish_logs
-- ---------------------------------------------------------------------------
create table public.publish_logs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid not null references public.admin_profiles (id),
  status public.publish_status not null,
  response_code int,
  error_message text,
  created_at timestamptz not null default now()
);

create index publish_logs_created_idx on public.publish_logs (created_at desc);
create index publish_logs_triggered_by_idx on public.publish_logs (triggered_by);

-- Index untuk FK yang tidak punya index otomatis.
create index site_settings_updated_by_idx on public.site_settings (updated_by);
