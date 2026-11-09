// Logika murni untuk POST /api/leads (PRD F-06, F-07, 3.4.1).
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { leadSchema } from '@/lib/validation/lead';
import type { Database } from '@/types/database';

export type LeadInput = z.output<typeof leadSchema>;
export type LeadInsert = Database['public']['Tables']['leads']['Insert'];

/** SHA-256(IP + salt) heksadesimal, 64 karakter (kolom `ip_hash`). IP mentah tidak pernah disimpan. */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256')
    .update(ip + salt)
    .digest('hex');
}

/** Honeypot terisi = bot. Server membalas sukses palsu tanpa menyimpan. */
export function isHoneypotFilled(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>).website;
  return typeof value === 'string' && value.trim() !== '';
}

/** Halaman asal form: hanya jalur internal yang wajar, selain itu null. */
export function cleanSourcePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.length > 200) return null;
  return value;
}

export interface LeadMeta {
  ipHash: string;
  userAgent: string | null;
  sourcePath: string | null;
}

export function buildLeadRow(data: LeadInput, meta: LeadMeta): LeadInsert {
  const extra =
    data.type === 'academy'
      ? { ...(data.age !== undefined ? { age: data.age } : {}), experience: data.experience }
      : {
          ...(data.email !== undefined ? { email: data.email } : {}),
          location_status: data.location_status,
        };
  return {
    type: data.type,
    full_name: data.full_name,
    whatsapp_number: data.whatsapp_number,
    city: data.city,
    message: data.message ?? null,
    extra,
    consent: true,
    ip_hash: meta.ipHash,
    user_agent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
    source_path: meta.sourcePath,
  };
}

export const DEFAULT_RATE_LIMIT_PER_HOUR = 5;

export function parseRateLimit(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT_PER_HOUR;
}
