# Golden Barber Indonesia — Website

Landing page + panel admin untuk Golden Barber (11 cabang, Bandung Raya & Jabodetabek).
Stack: Astro 5 · React · Tailwind CSS 4 · Supabase · Vercel.

## Mulai cepat (untuk user)

1. Taruh file HTML dari Claude Design ke `design-reference/html/public/` dan `design-reference/html/admin/`. Panduan: `design-reference/README.md`.
2. Buka folder ini di terminal, jalankan `claude`.
3. Ketik: `/mulai-milestone M1`
4. Lanjut milestone berikutnya setelah selesai: `/mulai-milestone M2`, dst.

Saat M2, siapkan project Supabase (URL, anon key, service role key). Saat M4, siapkan akun Vercel.

## Isi folder

| Path | Isi |
|------|-----|
| `CLAUDE.md` | Aturan kerja untuk Claude Code |
| `docs/PRD.md` | Product Requirement Document (sumber kebenaran fitur & data) |
| `docs/DESIGN-NOTES.md` | Ringkasan desain UI & token |
| `docs/DECISIONS.md` | Keputusan final yang menimpa PRD |
| `docs/PROGRESS.md` | Status pengerjaan & log |
| `docs/milestones/` | Checklist M1–M5 |
| `design-reference/` | Mockup HTML dari Claude Design (diisi user) |
| `src/data/seed/` | Data asli cabang, barber, harga, layanan (JSON) |
| `public/brand/` | Logo Golden Barber (asli, PNG transparan) |
| `.claude/commands/` | Slash command: `/mulai-milestone`, `/cek-ui`, `/cek-prd`, `/update-progress` |

## Perintah

```bash
npm run dev        # http://localhost:4321
npm run build
npm run test
npm run test:e2e
```
