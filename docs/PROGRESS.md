# PROGRESS — Status Pengerjaan

Claude Code: baca file ini di awal sesi, update di akhir setiap tugas.

## Posisi sekarang

- **Milestone aktif:** M2 (belum mulai)
- **Tugas berikutnya:** M2, mulai dari skema Supabase. Branch `m1-landing` belum di-merge ke `main`.
- **Blocker:** M2 butuh project Supabase (URL, anon key, service role key).

## Ringkasan milestone

| Milestone | Status | Mulai | Selesai |
|-----------|--------|-------|---------|
| M1 Fondasi & Landing Page | ✅ Selesai | 2026-11-04 | 2026-11-04 |
| M2 Database & Data Asli | ⬜ Belum | | |
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
