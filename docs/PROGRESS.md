# PROGRESS — Status Pengerjaan

Claude Code: baca file ini di awal sesi, update di akhir setiap tugas.

## Posisi sekarang

- **Milestone aktif:** M3 (jalan, branch `m3-admin`)
- **Tugas berikutnya:** M3 bagian 2: `/admin/leads` (tab, filter, cari, detail, status, catatan, Chat WA, ekspor CSV). Lalu bagian 3 (dashboard, cabang, barber, layanan).
- **Blocker:** (1) akun Super Admin pertama belum ada, jadi login sungguhan dan semua halaman admin yang butuh sesi belum bisa diuji end-to-end; (2) `LEAD_IP_SALT` (nilai ada di `.env` lokal) harus ditambahkan ke Environment Variables Vercel agar form lead berfungsi di produksi; (3) URL Configuration Supabase (Site URL dan Redirect URL reset password) belum diisi.

## Ringkasan milestone

| Milestone | Status | Mulai | Selesai |
|-----------|--------|-------|---------|
| M1 Fondasi & Landing Page | ✅ Selesai | 2026-11-04 | 2026-11-04 |
| M2 Database & Data Asli | ✅ Selesai | 2026-11-06 | 2026-11-06 |
| M3 Panel Admin | 🟨 Jalan | 2026-11-06 | |
| M4 QA & Launch | ⬜ Belum | | |
| M5 Pasca-Launch | ⬜ Belum | | |

Status: ⬜ Belum · 🟨 Jalan · ✅ Selesai · ⛔ Terblokir

## Cek awal (sebelum M1)

- [x] Struktur folder dibuat
- [x] PRD, catatan desain, keputusan, data seed tersedia
- [x] Logo asli (PNG transparan charcoal & putih)
- [x] File HTML mockup ditaruh di `design-reference/html/` (oleh user; satu file bundle berisi 23 artboard)

## Log

Format: `YYYY-MM-DD — [Mx] apa yang dikerjakan — catatan/sisa masalah`

- 2026-11-04 — [setup] Kerangka proyek, CLAUDE.md, milestone, seed JSON dibuat.
- 2026-11-04 — [M1] Setup Astro 5, design system, util + unit test, loader seed, semua section landing, LeadForm & PricelistPicker, aset dummy, e2e Playwright. Lolos: build, typecheck, lint, 54 unit test, 35 e2e (1 skip khusus viewport). Sisa masalah: (1) form lead belum menyimpan data tapi menampilkan "sudah kami terima"; jangan dirilis sebelum M3. (2) `seo_defaults.title` 63 karakter, melebihi batas F-08 (≤ 60); bereskan di M2. (3) `LeadForm` 28 KB gzip karena Zod; opsi hemat: `zod/mini`. (4) Tautan "Detail Cabang" & "Kebijakan Privasi" menunggu halamannya di M2 (D-13). (5) `install.ps1` di root bukan bagian proyek; dikecualikan lewat `.git/info/exclude`, tidak dihapus.
- 2026-11-04 — [M1] Cek UI mandiri: screenshot berdampingan dengan mockup per section di 1440 & 390, audit axe (WCAG A/AA), overflow 360–1920px, tap target. Diperbaiki: line-height, tap target logo/Sumber/Tanya/footer, teks mobile, kode pos di alamat, FAQ pertama terbuka, pola foto dummy. Sisa selisih disengaja: D-13, D-16. Belum diuji di perangkat asli (iPhone Safari, Android Chrome).
- 2026-11-06 — [M2] Migrasi (skema, trigger, RLS, storage), `scripts/build-seed-sql.ts` → `supabase/seed.sql`, klien Supabase (`build`/`server`/`service`), sumber data `json|supabase` lewat `DATA_SOURCE`, halaman `/cabang/[slug]` (11), `404`, `kebijakan-privasi`, `robots.txt`, sitemap, JSON-LD (`HairSalon`, `Organization`, `FAQPage`). Lolos: typecheck, lint, 65 unit test, 55 e2e (1 skip), build 11 halaman cabang dengan `DATA_SOURCE=json`. Keputusan D-18 s/d D-24. **Belum:** migrasi belum di-push (butuh login CLI + password DB), jadi lapisan Supabase belum diuji ke database sungguhan, RLS belum diuji, `database.ts` belum dibuat, Rich Results Test belum (butuh situs terdeploy). Catatan: (1) `.env` user berisi `DATA_SOURCE=supabase`, build lokal gagal sampai tabel ada; pakai `DATA_SOURCE=json` dulu. (2) Teks Kebijakan Privasi singkat dan belum ditinjau pemilik. (3) Koordinat dan `maps_embed_url` belum ada, jadi peta cabang berupa ilustrasi berlabel (D-22). (4) Selisih mockup yang disengaja: tautan "Detail Cabang" di kartu beranda (D-19). (5) Perbandingan visual dengan mockup hanya lewat screenshot Playwright 1440 & 390, belum berdampingan per piksel.
- 2026-11-06 — [M2] Migrasi di-push ke project Supabase `fpeykbrbifxfqzbpsgna` (4 migrasi, `db lint` bersih), seed masuk (11 cabang, 65 barber, 14 layanan, 154 ketersediaan, 8 FAQ, 8 galeri, 3 testimoni, 11 setting). `src/types/database.ts` dibuat dan dipakai klien. `npm run test:db`: 14 uji lolos (data identik dengan seed, RLS anon, constraint). Build dari Supabase lolos, 11 halaman cabang; typecheck, lint, 65 unit, 55 e2e lolos dengan `DATA_SOURCE=supabase`. **Sisa:** Rich Results Test (butuh situs terdeploy). Catatan: di Supabase CLI v3, `db push` dan `db lint` default ke database lokal, pakai `--remote`. Token CLI di `.env` (`SUPABASE_ACCESS_TOKEN`) hanya untuk kerja lokal; hapus di dashboard setelah M2.
- 2026-11-06 — [M2] Merge PR #1 (M1) dan #3 (M2) ke `main` (merge commit). Situs terdeploy di Vercel: https://golden-barber-landing-page.vercel.app (build dari Supabase). Dicek dari situs hidup: semua rute 200, 404 `noindex`, `robots.txt` dan sitemap memakai domain Vercel (11 halaman cabang + beranda + kebijakan privasi), canonical benar, JSON-LD `HairSalon` Dipatiukur lengkap (alamat, telepon, jam, priceRange, sameAs), beranda memuat `Organization` (department 11) dan `FAQPage`, tidak ada kunci service role di halaman dan aset JS yang dipindai. **Sisa M2:** user menjalankan Rich Results Test Google untuk `/cabang/dipatiukur/` (tidak bisa dijalankan dari sesi Claude). Kesalahan proses: menghapus branch `m1-landing` saat merge menutup PR #2 otomatis; diganti PR #3.
- 2026-11-06 — [M2] Rich Results Test Google untuk `/cabang/dipatiukur/` lolos: 2 item valid (Local businesses, Organization), tanpa error atau warning. **M2 selesai.** Situs produksi: https://golden-barber-landing-page.vercel.app.
- 2026-11-06 — [M3] Bagian 1 (fondasi admin) dan setengah bagian 2. Dibuat: `src/middleware.ts` (sesi Supabase, guard `/admin/*` dan `/api/admin/*`, cek Origin semua POST/PUT/PATCH/DELETE `/api/*`, halaman publik tetap statis tanpa cookie), `src/lib/api/{respond,guards,rate-limit,redirect,leads}.ts`, endpoint `/api/auth/{login,logout,me,forgot-password,reset-password}`, `AdminLayout` (sidebar, header, drawer mobile), `admin.css`, `ToastHost`, `ConfirmDialog`, `PublishBar` (belum tersambung), halaman `/admin/login`, `/admin/reset-password`, `/admin` (kerangka). `POST /api/leads` jadi dan `LeadForm` memakainya: honeypot sukses palsu, validasi Zod server, `ip_hash` SHA-256+salt, batas 5/jam per IP lewat tabel `leads`, insert service role. Uji nyata ke database: 5 lead tersimpan dengan `extra` benar, honeypot tidak tersimpan, lead ke-6 ditolak 429, tanpa Origin 403; baris uji dihapus, tabel `leads` kembali kosong. Lolos: typecheck, lint, 90 unit test, 83 e2e (5 skip: 4 butuh `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`, 1 khusus viewport). e2e lead memakai `page.route` agar tidak menulis ke database. Keputusan D-26, D-27. Catatan: e2e kini bisa dijalankan di port lain (`E2E_PORT=4400 npm run test:e2e`) karena 4321 sering dipakai dev server lain; dev server Vite yang berjalan lama bisa memberi "Outdated Optimize Dep", restart bila hidrasi island gagal.
