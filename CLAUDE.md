# CLAUDE.md — Golden Barber Indonesia

Panduan kerja untuk Claude Code. Baca file ini dulu di setiap sesi.

## Proyek

Landing page + panel admin untuk **Golden Barber Indonesia** (11 cabang barbershop di Bandung Raya & Jabodetabek).
Konversi utama: booking via WhatsApp. Lalu kunjungan ke cabang, lead Golden Academy, lead kemitraan.
Semua teks UI **Bahasa Indonesia**.

## Sumber kebenaran (urutan prioritas)

1. `docs/PRD.md` — fitur, acceptance criteria, skema DB, API. **Fungsi & data selalu ikut PRD.**
2. `docs/DECISIONS.md` — keputusan yang menimpa PRD (mis. token warna final). Menang atas PRD jika bertentangan.
3. `design-reference/html/` — mockup HTML dari Claude Design. **Tampilan selalu ikut ini.** Cara pakai: `design-reference/README.md`.
4. `docs/DESIGN-NOTES.md` — ringkasan desain, token, pola komponen, selisih desain vs PRD.
5. `src/data/seed/*.json` — data asli 11 cabang, barber, harga, layanan (Lampiran A PRD dalam bentuk JSON).

Kalau ada konflik yang tidak terjawab dokumen di atas: **berhenti dan tanya user**. Jangan menebak harga, alamat, atau nama barber.

## Tech stack

Astro 5 (static + rute on-demand) · React 19 island · Tailwind CSS 4 (`@tailwindcss/vite`) · Zod · nanostores
Supabase (Postgres + Auth + Storage) · `@supabase/ssr` · Vercel (`@astrojs/vercel`) · Vitest · Playwright

Package manager: **npm**. Node ≥ 20.

## Perintah

```bash
npm run dev          # server lokal http://localhost:4321
npm run build        # build produksi
npm run preview      # cek hasil build
npm run lint         # ESLint
npm run typecheck    # astro check
npm run test         # Vitest
npm run test:e2e     # Playwright
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

(Script di atas dibuat saat M1. Kalau belum ada, buat dulu di `package.json`.)

## Cara kerja per milestone

- Rencana kerja ada di `docs/milestones/M1.md` … `M5.md`. Kerjakan **berurutan**. Jangan lompat ke milestone berikutnya sebelum "Definition of Done" terpenuhi.
- Mulai sesi: baca `docs/PROGRESS.md` untuk tahu posisi terakhir.
- Selesai satu tugas: centang di `docs/PROGRESS.md`, tulis catatan singkat (tanggal, apa yang dikerjakan, sisa masalah).
- Slash command tersedia: `/mulai-milestone M1`, `/cek-ui <nama-section>`, `/cek-prd <F-xx>`, `/update-progress`.
- Commit kecil per fitur. Pesan commit Bahasa Indonesia, format `feat(landing): pricelist per cabang`.

## Aturan kode

- TypeScript `strict`. Tidak ada `any` tanpa komentar alasan.
- Halaman publik (`/`, `/cabang/[slug]`) **statis**. Hanya `/admin/*` dan `/api/*` memakai `export const prerender = false`.
- JS di halaman publik seminimal mungkin. Island React hanya untuk: `PricelistPicker`, `LeadForm`. Sisanya `.astro` + skrip inline kecil.
- Harga disimpan integer rupiah (`130000`). Tampil pakai `formatPriceShort` → `"130K"`, `aria-label` pakai `formatRupiah` → `"Rp130.000"`. Semua di `src/lib/format.ts`.
- Semua link WhatsApp lewat `buildWhatsAppUrl()` di `src/lib/whatsapp.ts`. Jangan tulis `wa.me` manual di komponen. Tiap link punya `data-wa-context` dan `data-branch` (untuk tracking M5).
- Template pesan WA ambil dari `site-settings.json` / tabel `site_settings` (PRD Lampiran A.5), bukan teks di mockup.
- Validasi pakai Zod di `src/lib/validation/`. Skema sama dipakai client & server.
- `SUPABASE_SERVICE_ROLE_KEY` hanya di kode server (`src/lib/supabase/service.ts`). Jangan pernah import file itu dari komponen client.
- RLS wajib aktif di semua tabel. Tiap migrasi baru: tambah policy-nya.
- Pesan error untuk pengguna: Bahasa Indonesia, sesuai tabel PRD 4.5. Envelope `{ success, data }` / `{ success: false, error: { code, message, details } }`.
- Aksesibilitas: kontras AA, tap target ≥ 44px (publik & admin mobile), semua gambar ada `alt`, form ada `label`.
- Gambar via `astro:assets`. Foto dummy di `public/images/dummy/`, beri tanda placeholder (`is_placeholder` / label "Ilustrasi").

## Aturan memakai design reference

- File HTML di `design-reference/html/` = **referensi visual**, bukan kode produksi.
- Ambil: layout, jarak, ukuran font, warna, urutan section, state komponen, teks UI.
- Bangun ulang sebagai komponen Astro/React + Tailwind dengan token di `src/styles/global.css`.
- **Jangan** salin skrip, framework runtime, atau atribut khusus tool desain (mis. data-dc-*) dari file HTML.
- **Jangan** pakai data dummy di mockup (harga "[rentang]", nomor `0812-0000-01xx`, template WA pendek). Pakai data dari `src/data/seed/`.
- Mockup memakai wordmark teks sebagai logo. Produksi pakai logo asli: `public/brand/logo-golden-barber.png` (charcoal) dan `logo-golden-barber-white.png` (untuk latar gelap).
- Bandingkan hasil dengan mockup di lebar **1440px** dan **390px** sebelum menandai section selesai.
- Kalau folder `design-reference/html/` masih kosong: kerjakan logika & struktur dulu, styling ikut `docs/DESIGN-NOTES.md`, lalu beri tahu user.

## Data yang belum pasti

Lihat PRD Lampiran B. Ringkas: alamat Cihampelas & Citra Raya, pricelist Citra Raya, jam buka (08.00–23.00 dipakai), arti "By Barber", jawaban FAQ walk-in & pembayaran, foto asli. Tampilkan sesuai fallback di PRD — jangan karang.

## Jangan

- Jangan pasang GA4 / Meta Pixel sebelum M5.
- Jangan buat booking slot online, multi-bahasa, atau toko produk (di luar scope).
- Jangan ubah `docs/PRD.md` tanpa izin user. Keputusan baru → tulis di `docs/DECISIONS.md`.
- Jangan hapus data seed; ubah lewat JSON lalu sinkronkan ke `supabase/seed.sql`.
