# Golden Barber Indonesia — Dokumentasi Desain UI

> **Versi:** 1.0 · **Tanggal:** 4 November 2026 · **Status:** Draft desain (mockup interaktif)
> **Pendamping:** `docs/PRD.md` (PRD tetap jadi sumber kebenaran fungsional) · Keputusan final: `docs/DECISIONS.md`
> **Canvas desain:** https://claude.ai/artifact/9EJdfYt3awtNYCk1m3yegY (artifact Design, privat). File HTML-nya ditaruh di `design-reference/html/`.

Dokumen ini merangkum hasil desain UI: daftar layar, token visual, pola komponen, keputusan desain, serta selisih dengan PRD.

---

## 1. Daftar Artboard

Semua artboard berupa halaman HTML interaktif. Lebar tetap: desktop 1440px, mobile 390px.

### 1.1 Situs Publik — Landing Page (`/`)

| File | Ukuran | Isi |
|------|--------|-----|
| `Main.dc.html` | 1440 · bagian 1/2 | Navbar sticky, Hero, Kenapa Golden? + blok rating, Cabang Kami (tab wilayah), Pricelist "Pilih Barbermu" (chip cabang) |
| `Desktop-2.dc.html` | 1440 · bagian 2/2 | Layanan (dropdown cabang), Galeri, Testimoni (carousel), Golden Academy + form, Kemitraan (section gelap) + form, FAQ, Footer |
| `Mobile-1.dc.html` | 390 · 1/3 | Navbar + drawer layar penuh, Hero, Kenapa Golden?, Cabang |
| `Mobile-2.dc.html` | 390 · 2/3 | Pricelist (dropdown), Layanan, Galeri 2 kolom, Testimoni |
| `Mobile-3.dc.html` | 390 · 3/3 | Academy + form, Kemitraan, FAQ, Footer |
| `Status.dc.html` | 1440 | State: drawer mobile terbuka, pricelist kosong Citra Raya (desktop & mobile), sukses form Academy |

Halaman dibagi beberapa artboard karena batas tinggi frame 8000px; secara produk tetap satu halaman.

### 1.2 Situs Publik — Halaman Lain

| File | Ukuran | Isi |
|------|--------|-----|
| `Cabang-Dago.dc.html` | 1440 | `/cabang/dago`: breadcrumb, header cabang + foto lebar, peta placeholder + kartu kontak, pricelist Dago, layanan, cabang lain di Bandung Raya, footer |
| `Cabang-Dago-Mobile.dc.html` | 390 | Versi mobile halaman yang sama |
| `404.dc.html` / `404-Mobile.dc.html` | 1440 / 390 | "Halaman tidak ditemukan", tombol "Lihat Semua Cabang" & "Booking via WhatsApp", tautan cepat |

### 1.3 Panel Admin (`/admin`)

| File | Ukuran | Isi |
|------|--------|-----|
| `Admin-Login.dc.html` | 1440 | Login + state error "Email atau password salah" |
| `Admin-Dashboard.dc.html` | 1440 | 4 kartu statistik, 5 lead terbaru, Aksi Cepat, Perlu Perhatian |
| `Admin-Cabang.dc.html` | 1440 | Tabel 11 cabang (drag handle, badge status) + panel edit samping (contoh error URL embed) |
| `Admin-Barber.dc.html` | 1440 | Filter cabang (Dipatiukur), tabel edit inline + indikator "Tersimpan", toggle By Barber/Aktif, dialog hapus |
| `Admin-Layanan.dc.html` | 1440 | Tab Katalog Layanan (kategori, tipe harga Tetap/Mulai dari/Rentang) |
| `Admin-Layanan-Matriks.dc.html` | 1440 | Tab Ketersediaan per Cabang: matriks 14 layanan × 11 cabang, kolom layanan sticky |
| `Admin-Leads.dc.html` | 1440 | Tab Academy/Kemitraan, filter status, cari, Ekspor CSV, panel detail + catatan; state kosong |
| `Admin-Galeri.dc.html` | 1440 | Dropzone, antrean unggah (progres & error > 3 MB), grid 8 kartu dengan toggle & handle |
| `Admin-Pengaturan.dc.html` | 1440 | Hero, Kontak, Template Pesan WA (chip placeholder + pratinjau), Rating Google, Teks Academy & Kemitraan |
| `Admin-State.dc.html` | 1440 | PublishBar 3 state, toast sukses/gagal, dialog hapus, state kosong, validasi form, legenda badge |
| `Admin-Barber-Mobile.dc.html` | 390 | Kartu per barber dengan input harga 2×2, autosave "Tersimpan", bottom sheet hapus |
| `Admin-Leads-Mobile.dc.html` | 390 | Daftar lead berbentuk kartu, chip filter geser, state kosong |
| `Admin-Lead-Detail-Mobile.dc.html` | 390 | Detail lead, status, isian form, catatan, bar aksi bawah |

Belum dirancang: admin Testimoni, FAQ, Pengguna, Reset Password; halaman Kebijakan Privasi.

---

## 2. Token Visual

### 2.1 Situs Publik

| Token | Nilai | Pemakaian |
|-------|-------|-----------|
| Latar | `#ECECEC` + tekstur beton CSS (radial-gradient bintik halus) | Latar halaman |
| Permukaan | `#F7F7F7` (kartu), `#FFFFFF` (tabel/form), `#F2F2F2` (section selang-seling) | |
| Garis | `#CFCFCF` | Kartu, tabel, pemisah |
| Teks | `#2B2F2F` utama · `#5B6161` sekunder | |
| Aksen besar | `#2E80BA` | Judul kategori kapital ≥ 20px tebal ("HAIRCUT REGULER", "ADD-ONS"), kata kedua hero |
| Aksen kecil / tombol | `#1F6497` (hover `#174E78`, latar lembut `#E3EEF6`) | Tombol primer, tautan, label kecil, header kolom tabel kecil |
| Harga coret | `#C43535` | Lolos kontras AA di teks kecil |
| Gelap | `#1E2121` + teks `#FFFFFF` / `#C9CECE` | Footer, section Kemitraan |
| Aksen di gelap | `#6FA9D6` | Angka "11" di Kemitraan |

### 2.2 Panel Admin

| Token | Nilai |
|-------|-------|
| Latar | `#F4F4F4` polos (tanpa tekstur) |
| Kartu | `#FFFFFF`, garis `#E0E0E0`, baris tabel `#EEEEEE`, header tabel `#FAFAFA` |
| Sidebar | `#1E2121`, item aktif `#1F6497` |
| PublishBar tayang | latar `#EEF5F0`, garis `#CFE1D5`, teks `#22603B` |
| PublishBar belum | latar `#FDF6DF`, garis `#EBD99A`, teks `#5E4800` |
| PublishBar memproses | latar `#EAF2F8`, garis `#C5DAEA`, teks `#1F6497` + spinner |
| Badge | Aktif/Tersedia/Selesai `#E7F2EA`/`#22603B` · Nonaktif/Tidak Tersedia `#EDEDED`/`#545A5A` · Cabang Baru/Dihubungi `#E3EEF6`/`#1F6497` · Baru/Segera Hadir `#FCF1D2`/`#6B5200` · Spam `#FBE9E9`/`#A12B2B` |
| Danger | `#B42318` (hover `#912018`), error field latar `#FFFBFB` |

### 2.3 Tipografi

| Peran | Font | Detail |
|-------|------|--------|
| Judul | Montserrat 700–800 | Hero 76px (mobile 40px), H2 44px (mobile 30px), admin H1 26px |
| Label kapital | Jost 400–500, `letter-spacing .18–.22em` | 11–13px, warna `#5B6161` |
| Body & harga | DM Sans 400–700 | Harga `font-variant-numeric: tabular-nums`, rata kanan |

### 2.4 Bentuk & Ukuran

- Radius 4–6px (badge pill 12px), bayangan hanya untuk elemen melayang (toast, floating WA, dialog).
- Ikon garis inline SVG stroke 1.4–1.8.
- Tap target: situs publik & admin mobile ≥ 44px; admin desktop tombol 40px, tombol kecil tabel 32px.
- Kontainer konten 1280px di 1440; gutter mobile 16–20px.

---

## 3. Pola Komponen

- **Pemisah tagline**: garis vertikal 1px `#8A9090` di label (`PRICELIST | Harga per barber`), meniru "Choose Your Haircut | The Winner's Cut".
- **Logo**: mockup memakai wordmark teks. Produksi memakai logo asli (lihat DECISIONS D-06).
- **Foto dummy**: blok abu `#B4B8B8` bergaris diagonal + tag "Foto dummy · …" / "Ilustrasi".
- **Tombol WA**: navbar ("Booking via WA"), hero, kartu cabang, per baris pricelist, dan floating kanan bawah (desktop pill berlabel, mobile bulat 60px dengan `aria-label`).
- **Tabel pricelist mobile**: grid `1fr 60px 60px 44px` — nama kiri, dua harga sejajar kanan, tombol WA ikon; tanpa scroll horizontal di 390px.
- **Pricelist desktop**: dua tabel berdampingan (landing) atau satu tabel + kolom samping "Sudah termasuk" (halaman cabang).
- **PublishBar admin**: di bawah header setiap layar admin; Publikasikan → memproses → toast sukses/gagal.
- **Edit inline harga**: sel tampil "130K"; klik → input angka + sufiks K, outline biru; label "Tersimpan" hijau setelah diubah. Harga coret merah dicoret.
- **Dialog hapus**: ikon tong sampah merah, opsi "Batal / Nonaktifkan saja / Hapus" (mobile: bottom sheet).
- **Tabel**: CSS grid + `role="table/row/cell"`.

---

## 4. Keputusan Desain & Asumsi

1. Tidak memakai design system akun; mengikuti palet & font dari brief.
2. Section Kemitraan memakai latar gelap `#1E2121` agar kontras dengan Academy.
3. Status "Segera Hadir" di mockup landing hanya contoh. Produksi pakai matriks seed (DECISIONS D-04).
4. Testimoni berlabel "Contoh konten — ganti dengan ulasan Google asli".
5. Data lead, nomor WA lead (`0812-0000-01xx`), dan nama "Admin Pusat" adalah data contoh.
6. Jumlah barber per cabang di mockup admin adalah angka contoh (seed asli: 65 barber).
7. Label kecil "Error 404 | Salah potong jalan" di halaman 404 bersifat opsional.

---

## 5. Selisih dengan PRD

Semua sudah diputuskan di `docs/DECISIONS.md` (D-01 s/d D-11). Yang masih terbuka: FAQ walk-in & pembayaran (menunggu pemilik).

---

## 6. Aset yang Masih Dibutuhkan

- Logo versi SVG (PNG transparan sudah dibuat dari JPG pemilik).
- Foto asli: interior cabang, hasil potongan untuk galeri, kelas Academy.
- Ulasan Google asli untuk testimoni.
