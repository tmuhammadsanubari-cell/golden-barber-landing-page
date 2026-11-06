# PROGRESS — Status Pengerjaan

Claude Code: baca file ini di awal sesi, update di akhir setiap tugas.

## Posisi sekarang

- **Milestone aktif:** M3 Panel Admin (jalan). Branch `m3-admin`, commit terakhir sudah di-push ke GitHub. **Belum di-merge ke `main` dan belum ada PR.** `main` sudah memuat M1 dan M2.
- **Tugas berikutnya:** M3 bagian 3 → Cabang (F-16), lalu Barber & Harga (F-17), Layanan (F-18). Detail di `docs/milestones/M3.md`.
- **Blocker:** tidak ada.
- **Jangan merge `m3-admin` ke `main` sebelum M3 selesai.** Panel admin masih sebagian; menu samping memuat tautan ke halaman yang belum ada (Cabang, Barber, Layanan, Galeri, Testimoni, FAQ, Pengaturan, Pengguna) dan akan 404.

### Sisa M3 (urut kerja)

1. **Bagian 3:** Cabang (tabel, urut ulang, panel edit, slug unik, satu cabang pusat, hapus dicegah bila ada barber), Barber & Harga (filter cabang, edit inline autosave, harga coret, pindah cabang, duplikasi harga, kartu mobile; D-09), Layanan (tab Katalog + Matriks, "Terapkan ke semua cabang", override harga; D-09).
2. **Bagian 4:** Publikasi: `GET /api/admin/publish/status`, `POST /api/admin/publish` (Vercel Deploy Hook, `publish_logs`, kunci 60 detik), `PublishBar` tersambung di setiap layar admin, banner "belum dipublikasikan" di Dashboard.
3. **Bagian 5:** Galeri + upload bertanda tangan (maks 3 MB, JPG/PNG/WebP), Testimoni, FAQ (tanpa mockup, pakai pola Galeri/Cabang), Pengaturan situs, Pengguna admin (undang, ubah peran, nonaktifkan, cegah hapus Super Admin terakhir).
4. **Definition of Done M3:** alur utama login → ubah harga Aditia → Publikasikan → harga baru tampil ≤ 5 menit; Editor tidak bisa buka `/admin/pengguna` (403); semua acceptance criteria F-14 s/d F-22 dicek dengan `/cek-prd`.
5. Uji yang tertunda: Editor tidak boleh menghapus lead (RLS, butuh akun Editor), masuk bersama F-22.

### Sudah selesai di M3 (per 2026-11-06)

Fondasi (middleware, auth, layout, login/reset), `POST /api/leads` + `LeadForm`, halaman Leads (F-19), Dashboard (F-15). Rincian di Log di bawah.

### Catatan serah-terima sesi

**Status layanan luar**
- Situs produksi: https://golden-barber-landing-page.vercel.app (deploy dari `main`, build membaca Supabase). Admin: `/admin/login`.
- Supabase project `fpeykbrbifxfqzbpsgna` (ap-southeast-1). Migrasi dan seed sudah di-push. `LEAD_IP_SALT` sudah ada di Vercel, URL Configuration Supabase sudah diisi, token CLI sudah dihapus user.
- Akun Super Admin: `tmuhammadsanubari@gmail.com` (nama "Admin Pusat"). Password diganti user sendiri; nilai terbaru ada di `.env` lokal (`E2E_ADMIN_PASSWORD`) untuk e2e. `.env` tidak masuk git.
- Setelah merge M3 ke `main`, tambah Environment Variable Vercel yang masih kurang bila ada fitur baru memakainya (`VERCEL_DEPLOY_HOOK_URL`, `VERCEL_API_TOKEN` untuk F-20; `UPLOAD_MAX_BYTES` opsional). Deploy Hook dibuat user di Vercel → Settings → Git → Deploy Hooks (branch `main`).

**Perintah penting**
- Dev server: `npm run dev`. Port 4321 sering dipakai dev server lain milik user; jangan dimatikan. Pakai port lain: `E2E_PORT=4400 npm run test:e2e` (Playwright menyalakan servernya sendiri).
- Tes admin dengan akun sungguhan butuh variabel `.env` di proses: `set -a; . ./.env; set +a` sebelum `npx playwright test` (bash), supaya `E2E_ADMIN_*`, `PUBLIC_SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` terbaca.
- Uji ke database: `npm run test:db`. Unit: `npm test` (109 tes). e2e penuh: 116 lolos, 2 skip.
- Supabase CLI v3: pakai `--remote` untuk `db push`/`db lint`; autentikasi lewat `SUPABASE_ACCESS_TOKEN` (token sudah dicabut, minta user buat baru bila perlu `db push` lagi).
- Seed: ubah JSON di `src/data/seed/`, lalu `npm run seed:build`.

**Jebakan yang sudah ditemui (hindari mengulang)**
- Dev server Vite yang lama menyala bisa memberi "Outdated Optimize Dep" dan island React tidak hidrasi. Restart server bila tes hidrasi gagal.
- Tes e2e harus menunggu hidrasi (`astro-island[ssr]` hilang) sebelum berinteraksi dengan island; elemen SSR sudah "enabled" sebelum itu.
- Tes admin berjalan paralel (desktop + mobile) dengan satu akun dan satu database: data uji harus diberi penanda unik per proses (`UJI-E2E ...`), dibersihkan lewat service role, dan asersi tidak boleh bergantung pada hitungan global.
- Pembatas login di memori terkunci 15 menit setelah 5 login gagal dari IP yang sama (hanya di dev server yang sama); restart dev server melepasnya.
- `supabase.auth.signOut()` bawaan mencabut semua sesi; sudah diganti `scope: 'local'` (D-28).
- Gaya `style=""` inline mengalahkan CSS responsif; untuk elemen yang disembunyikan di mobile pakai kelas + `!important` atau pindahkan ke CSS.
- Perintah Bash dengan heredoc panjang sering gagal di sesi ini ("unexpected EOF"); tulis berkas dengan tool Write dan edit multi-baris dengan tool Edit, bukan skrip `node -` bertanda kutip.
- Mockup ada di bundle HTML bersarang (`design-reference/html/{public,admin}/*.html`): unduh isi dengan membuka `__bundler/manifest` (base64 + gzip), lalu `template` di dalamnya berisi markup per layar.

**Keputusan terbaru:** D-18 s/d D-28 di `docs/DECISIONS.md` (judul SEO, `robots.txt`, auth admin, CSS admin, logout lokal, dan lain-lain).

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
- 2026-11-06 — [M3] Akun Super Admin pertama dibuat lewat Admin API Supabase (email dikonfirmasi, baris `admin_profiles` role `super_admin`, nama "Admin Pusat"). Password acak diberikan ke user lewat chat; kredensial untuk e2e lokal disimpan di `.env` (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, tidak masuk git). Login sungguhan lolos: e2e `admin-login` + `admin-auth` 28 lolos, termasuk login → dashboard → keluar → `/admin` kembali ke login dan pesan generik untuk password salah. Saran ke user: ganti password lewat "Lupa password?" setelah login pertama.
- 2026-11-06 — [M3] Bagian 2 selesai: `/admin/leads` (F-19). Tab Academy/Kemitraan dengan lencana jumlah baru, chip status berhitung, pencarian nama/kota/nomor (08… dan 62… sama-sama cocok, input disanitasi dari injeksi filter PostgREST), 25 baris/halaman, tabel desktop + kartu mobile, panel detail (desktop di samping, mobile satu halaman), ubah status dan catatan (tersimpan dengan `handled_by`), Chat WA ke `wa.me/{nomor lead}`, hapus permanen hanya Super Admin dengan konfirmasi, ekspor CSV streaming (UTF-8 BOM, mengikuti filter, `leads-{type}-{YYYYMMDD}.csv`, sel berawalan `=+-@` dinetralkan). API: `GET /api/admin/leads`, `GET/PATCH/DELETE /api/admin/leads/:id`, `GET /api/admin/leads/export`. Bug ditemukan e2e: `signOut()` global mengeluarkan semua perangkat; diganti `scope: 'local'` (D-28). Perbaikan UI: gaya inline mengalahkan CSS responsif di header (hide-sm), tombol Chat WA menimpa kolom kota. Lolos: typecheck, lint, 104 unit, 106 e2e tiga kali berturut-turut (2 skip: 1 viewport, 1 desktop-only di mobile); data uji e2e ditanam lewat service role lalu dihapus, tabel `leads` kosong. **Belum diuji:** hapus oleh Editor ditolak RLS (butuh akun Editor; akan masuk uji F-22).
- 2026-11-06 — [M3] Dashboard (F-15) selesai: 4 kartu (Cabang Aktif dengan rincian wilayah, Barber Aktif, Lead Baru dengan rincian Academy/Kemitraan dan tautan ke daftar, Publikasi Terakhir atau "Belum pernah"), 5 lead terbaru dengan Chat WA dan Detail (tabel desktop, kartu mobile), aksi cepat, dan "Perlu Perhatian" yang dihitung dari data (cabang tanpa barber aktif, alamat tidak lengkap, testimoni/galeri placeholder, FAQ nonaktif), semuanya mengikuti mockup. Fungsi murni diuji unit (`attentionItems`, `joinNames`). Lolos: typecheck, lint, 109 unit, 116 e2e tiga kali berturut-turut; e2e membandingkan kartu dengan isi database lewat service role. Alur reset password terbukti berfungsi di dunia nyata (user mengganti password lewat "Lupa password?", akun diperbarui setelah login terakhir). Password e2e di `.env` diperbarui oleh user. Banner "belum dipublikasikan" (F-15 poin 3) menunggu mekanisme perubahan-belum-terbit di F-20. Catatan: asersi hitungan global di e2e dibuat tidak bergantung angka karena tes paralel menanam/menghapus lead.
