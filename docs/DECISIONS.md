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
