# design-reference — Mockup UI dari Claude Design

Folder ini untuk **file HTML hasil Claude Design**. Claude Code memakainya sebagai referensi visual saat membangun UI.

## Cara mengisi (untuk user)

1. Export / unduh file HTML dari canvas Claude Design.
2. Taruh file sesuai kelompok:
   - `html/public/` → halaman situs publik (landing, cabang, 404, state)
   - `html/admin/` → layar panel admin
   - `assets/` → gambar, font, atau CSS terpisah yang ikut ter-export (jika ada)
3. Nama file boleh tetap seperti dari Claude Design. Kalau nama berbeda dari tabel di bawah, update kolom "File" di tabel ini.
4. Hapus file `.gitkeep` di folder yang sudah terisi (opsional).

## Catatan bundle

Mockup yang tersedia adalah satu file bundle, `html/public/Golden Barber Indonesia — Landing Page.html`, berisi 23 artboard sebagai iframe (salinan identik ada di `html/admin/`). Nama `*.dc.html` di tabel bawah adalah nama artboard di dalam bundle. Buka di browser untuk melihatnya.

## Peta file → rute / komponen

Nama default sesuai `docs/DESIGN-NOTES.md`. Centang kolom "Ada" setelah file ditaruh.

### Situs publik — `html/public/`

| Ada | File | Lebar | Rute / bagian | Komponen target |
|-----|------|-------|---------------|-----------------|
| [ ] | `Main.dc.html` | 1440 | `/` bagian 1: Navbar, Hero, Kenapa Golden, Cabang, Pricelist | `Navbar`, `Hero`, `About`, `BranchDirectory`, `PricelistSection` |
| [ ] | `Desktop-2.dc.html` | 1440 | `/` bagian 2: Layanan, Galeri, Testimoni, Academy, Kemitraan, FAQ, Footer | `ServicesSection`, `Gallery`, `Testimonials`, `AcademySection`, `PartnershipSection`, `Faq`, `Footer` |
| [ ] | `Mobile-1.dc.html` | 390 | `/` mobile 1/3: Navbar + drawer, Hero, Kenapa Golden, Cabang | sama |
| [ ] | `Mobile-2.dc.html` | 390 | `/` mobile 2/3: Pricelist, Layanan, Galeri, Testimoni | sama |
| [ ] | `Mobile-3.dc.html` | 390 | `/` mobile 3/3: Academy, Kemitraan, FAQ, Footer | sama |
| [ ] | `Status.dc.html` | 1440 | State: drawer terbuka, pricelist kosong (Citra Raya), sukses form | state komponen |
| [ ] | `Cabang-Dago.dc.html` | 1440 | `/cabang/[slug]` | `pages/cabang/[slug].astro` |
| [ ] | `Cabang-Dago-Mobile.dc.html` | 390 | `/cabang/[slug]` mobile | sama |
| [ ] | `404.dc.html` | 1440 | `/404` | `pages/404.astro` |
| [ ] | `404-Mobile.dc.html` | 390 | `/404` mobile | sama |

### Panel admin — `html/admin/`

| Ada | File | Lebar | Rute | Komponen target |
|-----|------|-------|------|-----------------|
| [ ] | `Admin-Login.dc.html` | 1440 | `/admin/login` | `pages/admin/login.astro` |
| [ ] | `Admin-Dashboard.dc.html` | 1440 | `/admin` | `pages/admin/index.astro` |
| [ ] | `Admin-Cabang.dc.html` | 1440 | `/admin/cabang` | `BranchForm`, `DataTable` |
| [ ] | `Admin-Barber.dc.html` | 1440 | `/admin/barber` | `BarberTable` |
| [ ] | `Admin-Barber-Mobile.dc.html` | 390 | `/admin/barber` mobile | `BarberTable` (mode kartu) |
| [ ] | `Admin-Layanan.dc.html` | 1440 | `/admin/layanan` tab Katalog | `ServiceCatalog` |
| [ ] | `Admin-Layanan-Matriks.dc.html` | 1440 | `/admin/layanan` tab Ketersediaan | `ServiceMatrix` |
| [ ] | `Admin-Leads.dc.html` | 1440 | `/admin/leads` | `LeadsTable` |
| [ ] | `Admin-Leads-Mobile.dc.html` | 390 | `/admin/leads` mobile | `LeadsTable` (mode kartu) |
| [ ] | `Admin-Lead-Detail-Mobile.dc.html` | 390 | detail lead mobile | `LeadsTable` panel detail |
| [ ] | `Admin-Galeri.dc.html` | 1440 | `/admin/galeri` | `GalleryManager` |
| [ ] | `Admin-Pengaturan.dc.html` | 1440 | `/admin/pengaturan` | `SettingsForm` |
| [ ] | `Admin-State.dc.html` | 1440 | State umum: PublishBar, toast, dialog, kosong, validasi | `PublishBar`, `Toast`, `ConfirmDialog` |

Belum ada mockup: admin Testimoni, FAQ, Pengguna, Reset Password, halaman Kebijakan Privasi.
Untuk layar ini, Claude Code memakai pola dari layar admin yang mirip (mis. Testimoni & FAQ meniru Galeri/Cabang).

## Aturan untuk Claude Code

- File di sini **referensi visual saja**. Jangan di-import, jangan di-serve, jangan disalin mentah ke `src/`.
- Ambil layout, spasi, ukuran, warna, teks UI, dan state. Bangun ulang sebagai komponen Astro/React + Tailwind.
- Abaikan skrip, runtime, dan atribut khusus tool desain di file HTML.
- Data (harga, alamat, template WA) **selalu dari `src/data/seed/`**, bukan dari mockup.
- Jika mockup dan PRD berbeda: tampilan ikut mockup, fungsi & data ikut PRD, lalu cek `docs/DECISIONS.md`.
- Cara cepat membaca mockup: buka di browser (`npx serve design-reference/html`) atau baca HTML-nya langsung.
