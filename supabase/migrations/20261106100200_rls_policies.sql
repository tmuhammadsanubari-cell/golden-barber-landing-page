-- M2 — Row Level Security (PRD 4.2, tabel RLS).
-- RLS aktif di semua tabel. Satu policy per role per perintah supaya tidak ada
-- policy permisif yang saling tumpang tindih.
--
-- Catatan: role `anon` tidak punya hak menjalankan is_admin(), jadi policy anon
-- tidak boleh memanggilnya. Policy untuk admin dipasang khusus role `authenticated`.
-- Insert lead, insert publish_logs, dan perubahan admin_profiles lewat service role
-- (melewati RLS) dari kode server.

-- ---------------------------------------------------------------------------
-- Fungsi bantu
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where id = (select auth.uid()) and is_active = true
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where id = (select auth.uid()) and is_active = true and role = 'super_admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Aktifkan RLS
-- ---------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.branches enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.branch_services enable row level security;
alter table public.gallery_items enable row level security;
alter table public.testimonials enable row level security;
alter table public.faqs enable row level security;
alter table public.site_settings enable row level security;
alter table public.leads enable row level security;
alter table public.publish_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Tabel konten: branches, barbers, services, gallery_items, testimonials, faqs
-- anon: SELECT baris aktif. Admin: SELECT/INSERT/UPDATE/DELETE semua baris.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['branches', 'barbers', 'services', 'gallery_items', 'testimonials', 'faqs']
  loop
    execute format(
      'create policy %I on public.%I for select to anon using (is_active)',
      t || '_anon_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (is_active or (select public.is_admin()))',
      t || '_auth_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      t || '_admin_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || '_admin_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      t || '_admin_delete', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- branch_services: anon SELECT jika cabang & layanan aktif. Admin SELECT/INSERT/UPDATE.
-- ---------------------------------------------------------------------------
create policy branch_services_anon_select on public.branch_services
  for select to anon
  using (
    exists (select 1 from public.branches b where b.id = branch_id and b.is_active)
    and exists (select 1 from public.services s where s.id = service_id and s.is_active)
  );

create policy branch_services_auth_select on public.branch_services
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      exists (select 1 from public.branches b where b.id = branch_id and b.is_active)
      and exists (select 1 from public.services s where s.id = service_id and s.is_active)
    )
  );

create policy branch_services_admin_insert on public.branch_services
  for insert to authenticated with check ((select public.is_admin()));

create policy branch_services_admin_update on public.branch_services
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- site_settings: SELECT untuk semua (dipakai build), UPDATE untuk admin.
-- ---------------------------------------------------------------------------
create policy site_settings_anon_select on public.site_settings
  for select to anon using (true);

create policy site_settings_auth_select on public.site_settings
  for select to authenticated using (true);

create policy site_settings_admin_update on public.site_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- leads: tanpa akses anon. Admin SELECT/UPDATE. Super admin + DELETE.
-- ---------------------------------------------------------------------------
create policy leads_admin_select on public.leads
  for select to authenticated using ((select public.is_admin()));

create policy leads_admin_update on public.leads
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy leads_super_delete on public.leads
  for delete to authenticated using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- admin_profiles: admin baca baris sendiri, super admin baca semua.
-- Perubahan lewat service role di endpoint.
-- ---------------------------------------------------------------------------
create policy admin_profiles_select on public.admin_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- publish_logs: admin SELECT. Insert lewat service role.
-- ---------------------------------------------------------------------------
create policy publish_logs_admin_select on public.publish_logs
  for select to authenticated using ((select public.is_admin()));
