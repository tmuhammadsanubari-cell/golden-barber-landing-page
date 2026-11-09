// Akses data testimoni untuk panel admin (PRD F-21). Klien sesi admin: RLS berlaku.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import type { TestimonialCreate, TestimonialPatch } from '@/lib/validation/admin-testimonials';
import type { Database } from '@/types/database';
import { reorderRows } from './content-order';

type Client = SupabaseClient<Database>;
export type TestimonialRow = Database['public']['Tables']['testimonials']['Row'];

export async function listTestimonials(supabase: Client): Promise<TestimonialRow[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

/** Cabang tujuan harus ada; kalau tidak, galat FK akan terbaca sebagai 500. */
async function branchExists(supabase: Client, id: string | null): Promise<boolean> {
  if (id === null) return true;
  const { data, error } = await supabase.from('branches').select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data !== null;
}

const BRANCH_MISSING = {
  ok: false,
  code: 'VALIDATION_ERROR',
  details: { branch_id: 'Cabang tidak ditemukan.' },
} as const;

/** Testimoni baru di akhir urutan. */
export async function createTestimonial(
  supabase: Client,
  input: TestimonialCreate,
): Promise<DbResult<TestimonialRow>> {
  if (!(await branchExists(supabase, input.branch_id))) return BRANCH_MISSING;
  const last = await supabase
    .from('testimonials')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (last.error) throw last.error;
  const { data, error } = await supabase
    .from('testimonials')
    .insert({ ...input, sort_order: (last.data?.[0]?.sort_order ?? 0) + 1 })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

export async function updateTestimonial(
  supabase: Client,
  id: string,
  input: TestimonialCreate,
): Promise<DbResult<TestimonialRow>> {
  if (!(await branchExists(supabase, input.branch_id))) return BRANCH_MISSING;
  const { data, error } = await supabase
    .from('testimonials')
    .update(input)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

export async function patchTestimonial(
  supabase: Client,
  id: string,
  patch: TestimonialPatch,
): Promise<DbResult<TestimonialRow>> {
  const { data, error } = await supabase
    .from('testimonials')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

export async function deleteTestimonial(
  supabase: Client,
  id: string,
): Promise<DbResult<{ id: string }>> {
  const { data, error } = await supabase.from('testimonials').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data ?? []).length > 0 ? { ok: true, data: { id } } : { ok: false, code: 'NOT_FOUND' };
}

export const reorderTestimonials = (
  supabase: Client,
  items: { id: string; sort_order: number }[],
) => reorderRows(supabase, 'testimonials', items, 'testimoni');
