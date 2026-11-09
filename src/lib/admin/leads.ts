// Logika murni halaman Leads admin (PRD F-19): label, kolom detail, filter, CSV.
// Tanpa akses jaringan agar mudah diuji.
import { formatPhoneDisplay, normalizePhone } from '@/lib/whatsapp';
import type { Database } from '@/types/database';

export type LeadRow = Database['public']['Tables']['leads']['Row'];
export type LeadType = LeadRow['type'];
export type LeadStatus = LeadRow['status'];

export const PAGE_SIZE = 25; // PRD F-19

export const TYPE_LABEL: Record<LeadType, string> = {
  academy: 'Academy',
  partnership: 'Kemitraan',
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Baru',
  contacted: 'Dihubungi',
  closed: 'Selesai',
  spam: 'Spam',
};

export const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'closed', 'spam'];

/** Kelas badge (admin.css) per status. */
export const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'b-warn',
  contacted: 'b-new',
  closed: 'b-ok',
  spam: 'b-err',
};

const EXPERIENCE_LABEL: Record<string, string> = {
  belum_pernah: 'Belum pernah',
  dasar: 'Dasar',
  sudah_bekerja: 'Sudah bekerja sebagai barber',
};

const LOCATION_LABEL: Record<string, string> = {
  sudah_ada: 'Sudah punya lokasi',
  belum_ada: 'Belum punya lokasi',
};

const TZ = 'Asia/Jakarta';

/** "4 Nov 2026" */
export function formatLeadDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "09.12" */
export function formatLeadTime(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  })
    .format(new Date(iso))
    .replace(':', '.');
}

/** "2026-11-04 09:12" (untuk CSV, waktu WIB). */
export function formatLeadStamp(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** "20261104" untuk nama berkas ekspor. */
export function datestamp(date: Date = new Date()): string {
  return formatLeadStamp(date.toISOString()).slice(0, 10).replaceAll('-', '');
}

interface Extra {
  age?: number;
  experience?: string;
  email?: string;
  location_status?: string;
}

const extraOf = (lead: Pick<LeadRow, 'extra'>): Extra =>
  typeof lead.extra === 'object' && lead.extra !== null && !Array.isArray(lead.extra)
    ? (lead.extra as Extra)
    : {};

export interface LeadField {
  label: string;
  value: string;
}

/** Semua isian form untuk panel detail, urut seperti form publik. */
export function leadFields(lead: LeadRow): LeadField[] {
  const extra = extraOf(lead);
  const fields: LeadField[] = [
    { label: 'Nama lengkap', value: lead.full_name },
    { label: 'Nomor WhatsApp', value: formatPhoneDisplay(lead.whatsapp_number) },
    {
      label: lead.type === 'academy' ? 'Kota domisili' : 'Kota rencana lokasi',
      value: lead.city,
    },
  ];
  if (lead.type === 'academy') {
    fields.push({ label: 'Usia', value: extra.age !== undefined ? String(extra.age) : '—' });
    fields.push({
      label: 'Pengalaman mencukur',
      value: EXPERIENCE_LABEL[extra.experience ?? ''] ?? '—',
    });
  } else {
    fields.push({ label: 'Email', value: extra.email ?? '—' });
    fields.push({
      label: 'Status lokasi',
      value: LOCATION_LABEL[extra.location_status ?? ''] ?? '—',
    });
  }
  fields.push({ label: 'Pesan', value: lead.message?.trim() ? lead.message : '—' });
  fields.push({ label: 'Setuju dihubungi', value: lead.consent ? 'Ya' : 'Tidak' });
  return fields;
}

/**
 * Tautan "Chat WA" ke lead: wa.me/{nomor lead} dengan sapaan awal (PRD F-19).
 * Sapaan ini dari admin ke lead, bukan template kunjungan di site_settings.
 */
export function leadWhatsAppUrl(
  lead: Pick<LeadRow, 'type' | 'full_name' | 'whatsapp_number'>,
): string {
  const team = lead.type === 'academy' ? 'Golden Academy' : 'tim kemitraan Golden Barber';
  const topic = lead.type === 'academy' ? 'belajar mencukur' : 'kemitraan';
  const text = `Halo ${lead.full_name}, kami dari ${team}. Terima kasih sudah mengisi form minat ${topic} di situs Golden Barber. Boleh kami bantu dengan informasi lebih lanjut?`;
  return `https://wa.me/${normalizePhone(lead.whatsapp_number)}?text=${encodeURIComponent(text)}`;
}

/**
 * Escape untuk nilai `ilike` PostgREST: buang karakter yang bisa memecah sintaks filter
 * `or(...)` (koma, kurung, tanda kutip, backslash) dan wildcard.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[,()"'\\%*_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/** Klausul `or=` untuk pencarian nama, kota, dan nomor WA. Kosong → null. */
export function searchClause(raw: string): string | null {
  const q = sanitizeSearch(raw);
  if (q === '') return null;
  const parts = [`full_name.ilike.*${q}*`, `city.ilike.*${q}*`];
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3) {
    // Input murni nomor: 0812… dan 62812… sama-sama cocok dengan nomor tersimpan (62…).
    const phoneLike = /^[\d\s+-]+$/.test(q);
    parts.push(`whatsapp_number.ilike.*${phoneLike ? normalizePhone(digits) : digits}*`);
  }
  return parts.join(',');
}

/** Sel CSV: kutip bila perlu, dan netralkan rumus spreadsheet (=, +, -, @). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const CSV_BOM = '\uFEFF'; // agar Excel membaca UTF-8 dengan benar (PRD F-19)

export const CSV_HEADER = [
  'Tanggal (WIB)',
  'Jenis',
  'Nama',
  'Nomor WhatsApp',
  'Kota',
  'Usia',
  'Pengalaman mencukur',
  'Email',
  'Status lokasi',
  'Pesan',
  'Status',
  'Catatan admin',
  'Halaman asal',
];

export function csvRow(lead: LeadRow): string {
  const extra = extraOf(lead);
  return [
    formatLeadStamp(lead.created_at),
    TYPE_LABEL[lead.type],
    lead.full_name,
    lead.whatsapp_number,
    lead.city,
    extra.age ?? '',
    EXPERIENCE_LABEL[extra.experience ?? ''] ?? '',
    extra.email ?? '',
    LOCATION_LABEL[extra.location_status ?? ''] ?? '',
    lead.message ?? '',
    STATUS_LABEL[lead.status],
    lead.admin_note ?? '',
    lead.source_path ?? '',
  ]
    .map(csvCell)
    .join(',');
}

export function csvFilename(type: LeadType | null, date: Date = new Date()): string {
  return `leads-${type ?? 'semua'}-${datestamp(date)}.csv`;
}
