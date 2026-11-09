// Skema FAQ untuk panel admin (PRD F-21). Dipakai client dan server.
import { z } from 'zod';

export const FAQ_MESSAGES = {
  answerPending:
    'Jawaban masih "menunggu konfirmasi pemilik". Isi jawaban final sebelum FAQ ditampilkan.',
};

/**
 * Jawaban kosong atau penanda "MENUNGGU KONFIRMASI PEMILIK" (seed, PRD Lampiran B) bukan jawaban
 * final: FAQ seperti itu tidak boleh tampil di situs.
 */
export function isPendingAnswer(answer: string): boolean {
  const text = answer.trim().toUpperCase();
  return text === '' || text.startsWith('MENUNGGU KONFIRMASI');
}

/** Aturan lintas-kolom: FAQ aktif wajib berjawaban final. Kunci = nama kolom. */
export function checkFaq(state: { is_active: boolean; answer: string }): Record<string, string> {
  if (state.is_active && isPendingAnswer(state.answer)) {
    return { answer: FAQ_MESSAGES.answerPending };
  }
  return {};
}

const question = z
  .string({ error: 'Pertanyaan wajib diisi.' })
  .trim()
  .min(1, 'Pertanyaan wajib diisi.')
  .min(5, 'Pertanyaan minimal 5 karakter.')
  .max(200, 'Pertanyaan maksimal 200 karakter.');

const answer = z
  .string({ error: 'Jawaban wajib diisi.' })
  .trim()
  .min(1, 'Jawaban wajib diisi.')
  .max(1000, 'Jawaban maksimal 1000 karakter.');

export const faqCreateSchema = z
  .object({
    question,
    answer,
    is_active: z.boolean({ error: 'Status tampil tidak valid.' }).default(true),
  })
  .superRefine((value, ctx) => {
    for (const [path, message] of Object.entries(checkFaq(value))) {
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  });

export type FaqCreate = z.output<typeof faqCreateSchema>;

/** PATCH: hanya saklar tampil di daftar. */
export const faqPatchSchema = z
  .object({ is_active: z.boolean({ error: 'Status tampil tidak valid.' }) })
  .strict();

export type FaqPatch = z.output<typeof faqPatchSchema>;
