---
description: Cek acceptance criteria fitur PRD (mis. /cek-prd F-03)
argument-hint: ID fitur (F-01 … F-22) atau "semua-must"
---

Verifikasi fitur **$ARGUMENTS** terhadap `docs/PRD.md`.

1. Ambil daftar acceptance criteria fitur tersebut (jika "semua-must", semua fitur 🔴 Must Have).
2. Untuk tiap kriteria: cari kodenya, jalankan test/uji manual yang relevan, tentukan ✅ / ❌ / ⚠️ sebagian.
3. Cek juga `docs/DECISIONS.md` untuk kriteria yang sudah diganti.
4. Laporkan tabel: Kriteria | Status | Bukti (file:baris atau hasil test) | Tindakan.
5. Perbaiki yang ❌ jika jelas. Catat hasil di `docs/PROGRESS.md`.
