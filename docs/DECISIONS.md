# DECISIONS — Keputusan yang Menimpa PRD

Catatan keputusan final. Jika bertentangan dengan `docs/PRD.md`, file ini yang dipakai.
Tambah baris baru setiap ada keputusan. Jangan hapus baris lama; tandai "Diganti oleh D-xx".

| ID | Tanggal | Topik | Keputusan | Alasan | Status |
|----|---------|-------|-----------|--------|--------|
| D-01 | 2026-11-04 | Tombol primer | Latar `#1F6497`, teks putih (hover `#174E78`) — bukan charcoal seperti PRD 4.9 | Mengikuti desain final | Final |
| D-02 | 2026-11-04 | Harga coret | `--color-strike: #C43535` (bukan `#D23F3F`) | Kontras AA untuk teks kecil | Final |
| D-03 | 2026-11-04 | Ikon WhatsApp | Ikon mengikuti warna tombol; hijau `#25D366` tidak dipakai | Menjaga palet | Final, bisa diubah user |
| D-04 | 2026-11-04 | Data pricelist & ketersediaan | Semua cabang pakai `src/data/seed/` (PRD Lampiran A.2 & A.4), bukan placeholder di mockup | Mockup hanya mengisi Dipatiukur & Dago | Final |
| D-05 | 2026-11-04 | Template pesan WA | Pakai teks PRD Lampiran A.5 (`site-settings.json`) | Mockup memakai teks pendek contoh | Final |
| D-06 | 2026-11-04 | Logo | Pakai logo asli `public/brand/logo-golden-barber.png` & `-white.png` (dipotong dari JPG pemilik, latar transparan). Mockup memakai wordmark teks | Logo asli sudah tersedia | Final — ganti dengan SVG bila pemilik kirim |
| D-07 | 2026-11-04 | Dua "By Barber" (Dago, Pasgar TKI 2) | Admin menampilkan `label` tier. Publik: nama tetap "By Barber", harga jadi pembeda | Menunggu konfirmasi pemilik | Sementara |
| D-08 | 2026-11-04 | Galeri | Tambah lightbox (PRD F-10) walau mockup belum ada | PRD | Final |
| D-09 | 2026-11-04 | Admin Barber & Layanan | Tambah aksi "Duplikasi harga", tombol "Terapkan ke semua cabang", dan override harga per sel (PRD F-17, F-18) dengan gaya komponen yang sudah ada | PRD | Final |
| D-10 | 2026-11-04 | Jam buka | 08.00–23.00 semua cabang | Pricelist resmi & bio Threads | Sementara (Lampiran B #3) |
| D-11 | 2026-11-04 | Tabel | Tabel boleh CSS grid + `role="table/row/cell"` seperti mockup, atau `<table>` semantik. Pricelist mobile wajib tanpa scroll horizontal di 390px | Desain | Final |
| D-12 | 2026-11-04 | Rentang harga di pemilih cabang | Format "85K–130K" dari harga Haircut Reguler (satu harga: "70K"; tanpa barber: "Segera hadir"), bukan contoh "Mulai 85K" di PRD F-03 | Mengikuti mockup & M1 ("rentang harga") | Final, bisa diubah user |
| D-13 | 2026-11-04 | Tautan ke halaman M2 | "Detail Cabang" (F-02) & "Kebijakan Privasi" (mockup footer) belum dipasang; link cabang di footer menuju `/?cabang=slug#harga`. Dipasang saat halamannya dibuat di M2 | Halaman belum ada, menghindari link 404 | Sementara |
| D-14 | 2026-11-04 | Foto dummy | Blok abu bergaris hasil `scripts/generate-placeholders.mjs`, bukan foto stok | Opsi di M1 §5; tanpa urusan lisensi | Sementara, sampai foto asli (Lampiran B #9) |
| D-15 | 2026-11-04 | Island layanan | `ServicesPanel` = named export di `PricelistPicker.tsx`, root React kedua, berbagi store `selectedBranch` | Section Pricelist & Layanan terpisah di mockup; PRD F-05 meminta store bersama | Final |
| D-16 | 2026-11-04 | Selisih kecil dengan mockup demi PRD | Tautan "Tanya" per layanan (F-05), tombol WA di sukses Kemitraan (F-07), FAQ memakai `details` (F-12), label sumber & tanggal di blok rating (F-09). Isi kartu Kenapa Golden, Academy, Kemitraan dari `site-settings.json`, bukan teks mockup | Fungsi & data ikut PRD | Final |
| D-17 | 2026-11-04 | Teks persetujuan form | Pakai teks mockup ("Saya setuju dihubungi tim ..."), bukan teks PRD F-06 | Teks UI ikut mockup; maknanya sama | Final, bisa diubah user |
| D-18 | 2026-11-06 | Judul SEO cabang & beranda | Judul ≤ 60 karakter dipilih bertingkat: "jalan + kota", "jalan saja", "kota saja". Dago jadi "Golden Barber Dago — Barbershop di Jl. Ir. H. Juanda" (contoh PRD F-08 setinggi 61 karakter, melanggar batas ≤ 60 miliknya sendiri). `seo_defaults.title` beranda: "Golden Barber — 11 Cabang Barbershop Bandung & Jabodetabek" (58; sebelumnya 63) | Acceptance criteria F-08 menang atas contoh | Final |
| D-19 | 2026-11-06 | Tautan halaman M2 | Kartu cabang beranda dapat tautan "Detail Cabang" (F-02). Tautan cabang di footer menuju `/cabang/[slug]` (bukan `/?cabang=slug#harga`). Footer dapat tautan "Kebijakan Privasi". Menggantikan D-13 | Halaman sudah ada | Final |
| D-20 | 2026-11-06 | Halaman cabang tanpa island | Pricelist & layanan halaman cabang memakai ulang tabel/kartu dari `PricelistPicker.tsx` (`BranchPricelistTable`, `BranchServicesList`) tanpa `client:`, jadi HTML statis nol JS | CLAUDE.md: JS publik seminimal mungkin | Final |
| D-21 | 2026-11-06 | `robots.txt` | Dibuat sebagai endpoint statis `src/pages/robots.txt.ts` (bukan `public/robots.txt`) agar baris `Sitemap:` mengikuti `PUBLIC_SITE_URL` | Domain produksi belum pasti | Final |
| D-22 | 2026-11-06 | Peta cabang | Tanpa `maps_embed_url`: blok peta ilustrasi berlabel "Ilustrasi peta" + tombol "Buka di Google Maps", tanpa iframe. Dengan `maps_embed_url`: iframe `loading="lazy"` | PRD F-13; koordinat & embed belum ada (Lampiran B) | Sementara |
| D-23 | 2026-11-06 | JSON-LD tanpa data karangan | `geo` hanya bila latitude & longitude ada; `priceRange` hanya bila cabang punya barber; `aggregateRating` tidak pernah dicantumkan; `addressLocality` = kota tanpa awalan "Kota/Kab." | PRD F-08: jangan karang data | Final |
| D-24 | 2026-11-06 | Seed SQL | `supabase/seed.sql` dibuat otomatis (`npm run seed:build`), aman dijalankan ulang (`on conflict do nothing` / `where not exists`), tidak menimpa suntingan admin. Trigger isi `branch_services` dimatikan sementara di dalam seed agar 154 baris A.4 masuk apa adanya | Seed tidak boleh merusak data admin | Final |
