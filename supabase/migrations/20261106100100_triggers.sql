-- M2 — Trigger (PRD 4.2): set_updated_at di semua tabel yang punya updated_at,
-- dan auto-insert branch_services saat cabang atau layanan baru dibuat.

-- ---------------------------------------------------------------------------
-- set_updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.admin_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.branches
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.barbers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.branch_services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.gallery_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
-- publish_logs tidak punya updated_at (hanya dicatat sekali).

-- ---------------------------------------------------------------------------
-- Auto-insert branch_services (status awal 'unavailable')
-- SECURITY DEFINER: admin editor boleh membuat cabang/layanan tanpa perlu
-- hak insert langsung lewat jalur lain.
-- ---------------------------------------------------------------------------
create or replace function public.fill_branch_services_for_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.branch_services (branch_id, service_id)
  select new.id, s.id from public.services s
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.fill_branch_services_for_service()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.branch_services (branch_id, service_id)
  select b.id, new.id from public.branches b
  on conflict do nothing;
  return new;
end;
$$;

create trigger fill_branch_services after insert on public.branches
  for each row execute function public.fill_branch_services_for_branch();
create trigger fill_branch_services after insert on public.services
  for each row execute function public.fill_branch_services_for_service();

-- Fungsi trigger tidak boleh dipanggil lewat API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.fill_branch_services_for_branch() from public, anon, authenticated;
revoke execute on function public.fill_branch_services_for_service() from public, anon, authenticated;
