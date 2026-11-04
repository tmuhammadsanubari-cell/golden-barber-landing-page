---
description: Mulai atau lanjutkan milestone (contoh /mulai-milestone M1)
argument-hint: M1|M2|M3|M4|M5
---

Kerjakan milestone **$ARGUMENTS**.

1. Baca `CLAUDE.md`, `docs/PROGRESS.md`, dan `docs/milestones/$ARGUMENTS.md`.
2. Cek milestone sebelumnya sudah ✅ di `docs/PROGRESS.md`. Kalau belum, beri tahu saya dan berhenti.
3. Cek prasyarat milestone (mis. mockup di `design-reference/html/`, kredensial Supabase). Kalau kurang, sebutkan apa yang dibutuhkan.
4. Buat task list dari checklist milestone. Lanjutkan dari item pertama yang belum dicentang.
5. Untuk setiap fitur, baca bagian PRD terkait (`docs/PRD.md`, cari ID F-xx) dan `docs/DECISIONS.md` sebelum menulis kode.
6. Setelah tiap item: jalankan `npm run typecheck` dan test terkait, centang di file milestone, tulis log di `docs/PROGRESS.md`, commit.
7. Akhir sesi: ringkas apa yang selesai, apa berikutnya, dan blocker.
