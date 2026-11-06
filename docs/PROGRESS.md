# PROGRESS — Status Pengerjaan

Claude Code: baca file ini di awal sesi, update di akhir setiap tugas.

## Posisi sekarang

- **Milestone aktif:** M2 (jalan, branch `m2-database`, bercabang dari `m1-landing`; keduanya belum di-merge ke `main`)
- **Tugas berikutnya:** `npx supabase login` → `link` → `db push` → seed → `db lint` → generate `src/types/database.ts` → uji RLS → ganti `DATA_SOURCE=supabase` dan cek data identik.
- **Blocker:** `supabase login` (buka browser) dan password database project. Kunci API sudah ada di `.env` dan valid.

## Ringkasan milestone

| Milestone | Status | Mulai | Selesai |
|-----------|--------|-------|---------|
| M1 Fondasi & Landing Page | ✅ Selesai | 2026-11-04 | 2026-11-04 |
| M2 Database & Data Asli | 🟨 Jalan | 2026-11-06 | |
| M3 Panel Admin | ⬜ Belum | | |
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
