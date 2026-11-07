// Publikasi perubahan (PRD F-20): fungsi murni. Akses database ada di `publish-db.ts`.

/** Tabel konten yang memengaruhi situs publik (PRD F-20). */
export const CONTENT_TABLES = [
  'branches',
  'barbers',
  'services',
  'branch_services',
  'gallery_items',
  'testimonials',
  'faqs',
  'site_settings',
] as const;

export type ContentTable = (typeof CONTENT_TABLES)[number];

/** Nama tabel untuk admin (Bahasa Indonesia). */
export const TABLE_LABEL: Record<ContentTable, string> = {
  branches: 'Cabang',
  barbers: 'Barber & Harga',
  services: 'Layanan',
  branch_services: 'Ketersediaan layanan',
  gallery_items: 'Galeri',
  testimonials: 'Testimoni',
  faqs: 'FAQ',
  site_settings: 'Pengaturan situs',
};

/** Jeda minimum antar publikasi sukses (PRD F-20). */
export const PUBLISH_COOLDOWN_SECONDS = 60;

/** Batas waktu menunggu Deploy Hook Vercel. */
export const HOOK_TIMEOUT_MS = 10_000;

/** Sisa detik kunci setelah publikasi sukses terakhir; 0 bila sudah boleh publikasi lagi. */
export function cooldownSecondsLeft(
  lastTriggeredAt: string | null,
  now: Date = new Date(),
): number {
  if (!lastTriggeredAt) return 0;
  const elapsedMs = now.getTime() - new Date(lastTriggeredAt).getTime();
  if (Number.isNaN(elapsedMs)) return 0;
  const left = Math.ceil(PUBLISH_COOLDOWN_SECONDS - elapsedMs / 1000);
  return Math.min(PUBLISH_COOLDOWN_SECONDS, Math.max(0, left));
}

/** Hitungan per tabel → hanya tabel yang berubah (urutan CONTENT_TABLES) dan totalnya. */
export function summarizeChanges(counts: Partial<Record<ContentTable, number>>): {
  changedTables: ContentTable[];
  total: number;
} {
  const changedTables = CONTENT_TABLES.filter((table) => (counts[table] ?? 0) > 0);
  const total = changedTables.reduce((sum, table) => sum + (counts[table] ?? 0), 0);
  return { changedTables, total };
}

export interface PublishLastLog {
  status: 'triggered' | 'failed';
  created_at: string;
  triggered_by: string | null;
}

export interface PublishStatus {
  has_unpublished_changes: boolean;
  /** Jumlah baris konten yang berubah sejak publikasi sukses terakhir. */
  pending_count: number;
  changed_tables: ContentTable[];
  last_publish: PublishLastLog | null;
  /** Waktu publikasi sukses terakhir (`triggered`), dasar perhitungan "belum dipublikasikan". */
  last_success_at: string | null;
  cooldown_seconds_left: number;
}

/** "7 Nov 2026, 14.05" (WIB), untuk PublishBar dan riwayat. */
export function formatPublishTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}.${get('minute')}`;
}

export type HookOutcome =
  | { ok: true; code: number }
  | { ok: false; code: number | null; message: string };

/**
 * Panggil Deploy Hook. URL tidak pernah masuk ke pesan galat (URL hook = rahasia).
 * `fetchImpl` bisa diganti di tes supaya tidak memicu build sungguhan.
 */
export async function callDeployHook(
  hookUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HookOutcome> {
  try {
    const response = await fetchImpl(hookUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
    });
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, code: response.status };
    }
    return { ok: false, code: response.status, message: `Deploy Hook membalas HTTP ${response.status}` };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return {
      ok: false,
      code: null,
      message: name === 'TimeoutError' ? 'Deploy Hook tidak merespons (timeout)' : 'Deploy Hook tidak terjangkau',
    };
  }
}
