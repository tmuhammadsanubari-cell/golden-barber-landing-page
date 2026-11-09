// Skema pengaturan situs untuk panel admin (PRD F-21, A.5). Dipakai client dan server.
// Template pesan WhatsApp dibatasi pada placeholder yang BENAR-BENAR terisi di tempat template itu
// dipakai: placeholder kosong membuat build situs gagal (`fillTemplate` melempar galat).
import { z } from 'zod';
import { isSitePath, isStoragePath } from '@/lib/media';
import { normalizePhone } from '@/lib/whatsapp';
import type { WhatsAppTemplateKey } from '@/types/content';

/** Kunci yang boleh diubah lewat PUT /api/admin/settings/:key. `media_mentions` dan `seo_defaults` tidak. */
export const EDITABLE_KEYS = [
  'hero',
  'whatsapp_number',
  'whatsapp_templates',
  'social_links',
  'google_rating',
  'about_highlights',
  'haircut_includes',
  'academy_section',
  'partnership_section',
] as const;
export type EditableKey = (typeof EDITABLE_KEYS)[number];

export const isEditableKey = (key: string): key is EditableKey =>
  (EDITABLE_KEYS as readonly string[]).includes(key);

// ---------------------------------------------------------------------------------------------
// Template pesan WhatsApp
// ---------------------------------------------------------------------------------------------

export const TEMPLATE_KEYS = [
  'general',
  'branch',
  'barber',
  'service',
  'branch_no_pricelist',
  'academy',
  'partnership',
] as const satisfies readonly WhatsAppTemplateKey[];

/** Placeholder yang tersedia per template (sesuai pemanggil `whatsAppLinkProps` di situs). */
export const TEMPLATE_PLACEHOLDERS: Record<WhatsAppTemplateKey, readonly string[]> = {
  general: [],
  branch: ['nama_cabang'],
  barber: ['nama_cabang', 'nama_barber', 'layanan', 'harga'],
  service: ['nama_layanan', 'nama_cabang'],
  branch_no_pricelist: ['nama_cabang'],
  academy: ['nama'],
  partnership: ['nama'],
};

/** Placeholder `{x}` di teks yang tidak tersedia untuk template ini. */
export function unknownPlaceholders(template: string, allowed: readonly string[]): string[] {
  const found = [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
  return [...new Set(found.filter((name) => !allowed.includes(name)))];
}

export function placeholderMessage(unknown: string[], allowed: readonly string[]): string {
  const list = unknown.map((name) => `{${name}}`).join(', ');
  const hint =
    allowed.length === 0
      ? 'Template ini tidak memakai placeholder.'
      : `Yang tersedia: ${allowed.map((name) => `{${name}}`).join(', ')}.`;
  return `Placeholder ${list} tidak bisa dipakai di template ini. ${hint}`;
}

const templateText = (key: WhatsAppTemplateKey) =>
  z
    .string({ error: 'Template wajib diisi.' })
    .trim()
    .min(5, 'Template minimal 5 karakter.')
    .max(500, 'Template maksimal 500 karakter.')
    .superRefine((value, ctx) => {
      const unknown = unknownPlaceholders(value, TEMPLATE_PLACEHOLDERS[key]);
      if (unknown.length > 0) {
        ctx.addIssue({ code: 'custom', message: placeholderMessage(unknown, TEMPLATE_PLACEHOLDERS[key]) });
      }
    });

export const whatsappTemplatesSchema = z.object(
  Object.fromEntries(TEMPLATE_KEYS.map((key) => [key, templateText(key)])) as Record<
    WhatsAppTemplateKey,
    ReturnType<typeof templateText>
  >,
);

// ---------------------------------------------------------------------------------------------
// Kontak
// ---------------------------------------------------------------------------------------------

export const PHONE_MESSAGE = 'Nomor WhatsApp tidak valid. Contoh: 0812-1480-7192.';

/** Nomor ponsel Indonesia: dinormalkan ke "628…" (hanya digit). */
export const whatsappNumberSchema = z
  .string({ error: PHONE_MESSAGE })
  .transform((value) => normalizePhone(value))
  .refine((value) => /^628\d{8,12}$/.test(value), { error: PHONE_MESSAGE });

const httpsUrl = (message: string, pattern?: RegExp) =>
  z
    .string({ error: message })
    .trim()
    .max(200, 'Tautan maksimal 200 karakter.')
    .refine(
      (value) => {
        try {
          return new URL(value).protocol === 'https:' && (!pattern || pattern.test(value));
        } catch {
          return false;
        }
      },
      { error: message },
    );

const URL_MESSAGE = 'Masukkan URL lengkap berawalan https://, mis. https://instagram.com/namaakun';

export const socialLinksSchema = z.object({
  instagram: httpsUrl(
    'Masukkan URL Instagram lengkap, mis. https://www.instagram.com/goldenbarber_id/',
    /^https:\/\/(www\.)?instagram\.com\/[^/?#]+/i,
  ),
  threads: httpsUrl(
    'Masukkan URL Threads lengkap, mis. https://www.threads.com/@goldenbarber_id',
    /^https:\/\/(www\.)?threads\.(net|com)\/@[^/?#]+/i,
  ),
  /** Opsional: kosong = tidak dipakai. */
  linktree: z.union([z.literal(''), httpsUrl(URL_MESSAGE)]),
  academy_instagram: httpsUrl(
    'Masukkan URL Instagram Academy lengkap, mis. https://www.instagram.com/goldenacademybandung/',
    /^https:\/\/(www\.)?instagram\.com\/[^/?#]+/i,
  ),
});

// ---------------------------------------------------------------------------------------------
// Hero, rating, teks
// ---------------------------------------------------------------------------------------------

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .min(min, `${label} minimal ${min} karakter.`)
    .max(max, `${label} maksimal ${max} karakter.`);

const imagePath = z
  .string({ error: 'Gambar hero wajib ada.' })
  .refine((value) => isStoragePath(value) || isSitePath(value), {
    error: 'Path gambar tidak valid. Unggah ulang gambarnya.',
  });

export const heroSchema = z.object({
  title: text('Judul', 5, 120),
  subtitle: text('Subjudul', 10, 160),
  primary_cta: text('Teks tombol utama', 2, 40),
  secondary_cta: text('Teks tombol kedua', 2, 40),
  image_path: imagePath,
  image_is_placeholder: z.boolean({ error: 'Label ilustrasi tidak valid.' }),
});

const isoDate = z
  .string({ error: 'Tanggal wajib diisi.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
    error: 'Tanggal tidak valid.',
  });

export const googleRatingSchema = z.object({
  rating: z
    .number({ error: 'Nilai rating harus berupa angka, mis. 4,9.' })
    .min(1, 'Nilai rating antara 1 dan 5.')
    .max(5, 'Nilai rating antara 1 dan 5.')
    .refine((value) => Math.round(value * 10) / 10 === value, {
      error: 'Nilai rating maksimal satu angka desimal.',
    }),
  review_count: z
    .number({ error: 'Jumlah ulasan harus berupa angka.' })
    .int('Jumlah ulasan harus bilangan bulat.')
    .min(0, 'Jumlah ulasan tidak boleh negatif.')
    .max(10_000_000, 'Jumlah ulasan terlalu besar.'),
  scope: text('Sumber cabang', 2, 60),
  updated_at: isoDate,
});

export const academySchema = z.object({
  title: text('Judul', 5, 100),
  description: text('Deskripsi', 20, 500),
  is_details_available: z.boolean({ error: 'Status detail kelas tidak valid.' }),
});

export const partnershipSchema = z.object({
  title: text('Judul', 5, 100),
  description: text('Narasi', 20, 500),
});

export const HIGHLIGHT_ICONS = [
  'message-circle',
  'droplets',
  'clock',
  'users',
  'trophy',
  'heart-handshake',
  'scissors',
  'star',
  'pin',
] as const;

export const aboutHighlightsSchema = z
  .array(
    z.object({
      icon: z.enum(HIGHLIGHT_ICONS, { error: 'Pilih ikon.' }),
      title: text('Judul', 2, 40),
      description: text('Deskripsi', 5, 160),
    }),
    { error: 'Daftar poin keunggulan tidak valid.' },
  )
  .min(1, 'Minimal satu poin keunggulan.')
  .max(8, 'Maksimal 8 poin keunggulan.');

export const haircutIncludesSchema = z
  .array(text('Item', 2, 60), { error: 'Daftar tidak valid.' })
  .min(1, 'Minimal satu item.')
  .max(8, 'Maksimal 8 item.');

export const SETTINGS_SCHEMAS = {
  hero: heroSchema,
  whatsapp_number: whatsappNumberSchema,
  whatsapp_templates: whatsappTemplatesSchema,
  social_links: socialLinksSchema,
  google_rating: googleRatingSchema,
  about_highlights: aboutHighlightsSchema,
  haircut_includes: haircutIncludesSchema,
  academy_section: academySchema,
  partnership_section: partnershipSchema,
} as const satisfies Record<EditableKey, z.ZodType>;

/** Isi body PUT /api/admin/settings/:key. */
export const settingPutSchema = z.object({ value: z.unknown() });
