// Hasil operasi database yang dipetakan ke envelope API. Dipakai modul `*-db.ts` panel admin.
import { fail, ok, type ErrorCode } from './respond';

export type DbResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message?: string; details?: Record<string, string> };

/** Sukses → `ok(data)`; gagal → envelope error dengan pesan khusus bila ada. */
export function respondDb<T>(result: DbResult<T>, status = 200): Response {
  if (result.ok) return ok(result.data, { status });
  return fail(result.code, { message: result.message, details: result.details });
}
