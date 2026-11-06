import { formatPriceShort } from '@/lib/format';
import type { Branch, WhatsAppSettings, WhatsAppTemplateKey } from '@/types/content';

export type WhatsAppContext = WhatsAppTemplateKey;

/** Nilai `data-wa-context` yang dibaca tracking M5 (PRD F-04). */
export type WhatsAppTrackingContext = Exclude<WhatsAppContext, 'branch_no_pricelist'>;

export interface WhatsAppArgs {
  context: WhatsAppContext;
  settings: WhatsAppSettings;
  branch?: Pick<Branch, 'slug' | 'name' | 'whatsapp_number'>;
  barber?: string;
  service?: string;
  /** Harga rupiah; tampil di pesan sebagai "130K". */
  price?: number;
  name?: string;
}

/** Hapus selain digit, ganti awalan 0 → 62. "0812-1480-7192" → "6281214807192". */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

/** "6281214807192" → "0812-1480-7192" (tampilan footer). */
export function formatPhoneDisplay(input: string): string {
  const local = `0${normalizePhone(input).slice(2)}`;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}

function fillTemplate(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    if (!value) throw new Error(`Placeholder WhatsApp {${key}} tidak terisi`);
    return value;
  });
}

export function buildWhatsAppMessage(args: WhatsAppArgs): string {
  const { context, settings, branch, barber, service, price, name } = args;
  return fillTemplate(settings.whatsapp_templates[context], {
    nama_cabang: branch?.name,
    nama_barber: barber,
    layanan: service,
    nama_layanan: service,
    harga: price === undefined ? undefined : formatPriceShort(price),
    nama: name,
  });
}

export function buildWhatsAppUrl(args: WhatsAppArgs): string {
  const number = normalizePhone(args.branch?.whatsapp_number ?? args.settings.whatsapp_number);
  return `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppMessage(args))}`;
}

/** Atribut lengkap untuk `<a>` WhatsApp: href, tab baru, dan data tracking M5. */
export function whatsAppLinkProps(args: WhatsAppArgs) {
  const context: WhatsAppTrackingContext =
    args.context === 'branch_no_pricelist' ? 'branch' : args.context;
  return {
    href: buildWhatsAppUrl(args),
    target: '_blank',
    rel: 'noopener',
    'data-wa-context': context,
    'data-branch': args.branch?.slug ?? '',
  };
}
