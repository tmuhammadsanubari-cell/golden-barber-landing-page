// Pembatas laju sederhana di memori, per instance serverless. Hanya "best effort" untuk
// endpoint login dan lupa password; lapisan utama tetap rate limit bawaan Supabase Auth.
// Rate limit lead memakai database (ip_hash di tabel leads), bukan ini.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  limited: boolean;
  /** Detik sampai slot berikutnya terbuka (0 bila tidak dibatasi). */
  retryAfter: number;
}

/** Catat satu kejadian untuk `key`; `limited` bila sudah melewati `limit` dalam `windowMs`. */
export function hit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => now - time < windowMs);
  buckets.set(key, bucket);
  if (bucket.hits.length >= limit) {
    return { limited: true, retryAfter: Math.ceil((bucket.hits[0]! + windowMs - now) / 1000) };
  }
  bucket.hits.push(now);
  return { limited: false, retryAfter: 0 };
}

/** Apakah `key` sedang dibatasi, tanpa mencatat kejadian baru. */
export function isLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  const recent = bucket ? bucket.hits.filter((time) => now - time < windowMs) : [];
  if (recent.length >= limit) {
    return { limited: true, retryAfter: Math.ceil((recent[0]! + windowMs - now) / 1000) };
  }
  return { limited: false, retryAfter: 0 };
}

export function reset(key: string): void {
  buckets.delete(key);
}

/** Hanya untuk test. */
export function clearAll(): void {
  buckets.clear();
}
