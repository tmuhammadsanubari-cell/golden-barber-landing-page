-- M2 — Storage bucket `media` (PRD 4.2): baca publik, tulis/hapus hanya admin.
-- Batas 3 MB per berkas (UPLOAD_MAX_BYTES), hanya gambar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  3145728,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket publik: URL objek bisa dibuka tanpa policy SELECT. Policy SELECT
-- sengaja hanya untuk admin, supaya daftar isi bucket tidak bisa dienumerasi anon.
create policy media_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

create policy media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));

create policy media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
