# Data seed

Data asli dari pricelist Instagram @goldenbarber_id (±Maret 2026) = PRD Lampiran A dalam bentuk JSON.
Harga dalam rupiah penuh (integer). Relasi pakai `branch_slug` / `service_slug`.

| File | Isi | Jumlah |
|------|-----|--------|
| `branches.json` | Cabang (A.1) | 11 |
| `barbers.json` | Barber & harga (A.2) | 65 |
| `services.json` | Katalog layanan (A.3) | 14 |
| `branch-services.json` | Ketersediaan layanan per cabang (A.4) | 154 |
| `site-settings.json` | Pengaturan situs (A.5) | — |
| `faqs.json` | FAQ; 2 item `is_active: false` menunggu jawaban pemilik | 8 |
| `gallery.json` | Galeri — semua placeholder | 8 |
| `testimonials.json` | Testimoni — semua placeholder | 3 |

Aturan:
- M1: dibaca langsung oleh `src/lib/data/`.
- M2: jadi sumber `supabase/seed.sql` (lewat script). Setelah M2, data hidup di Supabase dan diubah lewat admin.
- Perlu verifikasi pemilik: lihat PRD Lampiran B.
