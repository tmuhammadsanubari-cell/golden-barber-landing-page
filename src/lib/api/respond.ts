// Envelope respons API (PRD 4.3 & 4.5). Semua pesan untuk pengguna dalam Bahasa Indonesia;
// detail teknis hanya ke log server.
import type { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'PUBLISH_FAILED'
  | 'INTERNAL_ERROR';

export const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: 'Data yang dikirim belum valid.' },
  UNAUTHORIZED: { status: 401, message: 'Sesi Anda berakhir, silakan login kembali.' },
  FORBIDDEN: { status: 403, message: 'Anda tidak memiliki akses ke fitur ini.' },
  NOT_FOUND: { status: 404, message: 'Data tidak ditemukan.' },
  CONFLICT: { status: 409, message: 'Data bentrok dengan data yang sudah ada.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'Ukuran file maksimal 3 MB.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Format file harus JPG, PNG, atau WebP.' },
  RATE_LIMITED: { status: 429, message: 'Terlalu banyak percobaan, coba lagi nanti.' },
  PUBLISH_FAILED: { status: 502, message: 'Publikasi gagal, coba lagi.' },
  INTERNAL_ERROR: { status: 500, message: 'Terjadi kesalahan pada server.' },
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function ok<T>(data: T, init: { status?: number; headers?: HeadersInit } = {}): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init.headers as Record<string, string> | undefined) },
  });
}

export interface FailOptions {
  /** Pesan khusus kasus ini (mis. CONFLICT). Kosong = pesan standar kode. */
  message?: string;
  details?: Record<string, string>;
  headers?: HeadersInit;
}

export function fail(code: ErrorCode, options: FailOptions = {}): Response {
  const { status, message } = ERRORS[code];
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message: options.message ?? message, details: options.details ?? {} },
    }),
    {
      status,
      headers: { ...JSON_HEADERS, ...(options.headers as Record<string, string> | undefined) },
    },
  );
}

/** Error Zod → { "nama.field": "pesan pertama" }. Pesan skema sudah Bahasa Indonesia. */
export function zodToDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    details[key] ??= issue.message;
  }
  return details;
}

export function validationFail(error: ZodError): Response {
  return fail('VALIDATION_ERROR', { details: zodToDetails(error) });
}

/** Catat error teknis ke log server, balas pesan generik. */
export function internalError(error: unknown, context: string): Response {
  console.error(`[api] ${context}`, error);
  return fail('INTERNAL_ERROR');
}

/** Baca body JSON; `undefined` bila bukan JSON valid. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
