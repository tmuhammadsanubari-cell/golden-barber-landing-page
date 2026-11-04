---
description: Bandingkan section/halaman yang sudah dibuat dengan mockup HTML
argument-hint: nama section atau rute (mis. pricelist, /cabang/dago, admin-barber)
---

Bandingkan implementasi **$ARGUMENTS** dengan mockup di `design-reference/html/`.

1. Cari file mockup yang sesuai lewat tabel di `design-reference/README.md`.
2. Jalankan `npm run dev`. Ambil tampilan di lebar 1440px dan 390px (pakai Playwright screenshot jika tersedia).
3. Buka mockup yang sama di lebar yang sama.
4. Bandingkan: urutan elemen, spasi, ukuran font, warna token, radius, state (hover, aktif, kosong, error), teks UI.
5. Ingat aturan: data ikut `src/data/seed/`, keputusan ikut `docs/DECISIONS.md` — perbedaan karena dua hal ini **bukan** bug.
6. Laporkan selisih dalam tabel (Elemen | Mockup | Implementasi | Perbaikan), lalu perbaiki yang jelas salah. Tanya saya untuk yang ambigu.
