// Akses data FAQ untuk panel admin (PRD F-21). Klien sesi admin: RLS berlaku.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import { checkFaq, type FaqCreate, type FaqPatch } from '@/lib/validation/admin-faqs';
import type { Database } from '@/types/database';
import { reorderRows } from './content-order';

type Client = SupabaseClient<Database>;
export type FaqRow = Database['public']['Tables']['faqs']['Row'];

export async function listFaqs(supabase: Client): Promise<FaqRow[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

async function getRow(supabase: Client, id: string): Promise<FaqRow | null> {
  const { data, error } = await supabase.from('faqs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** FAQ baru di akhir urutan. */
export async function createFaq(supabase: Client, input: FaqCreate): Promise<DbResult<FaqRow>> {
  const last = await supabase
    .from('faqs')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (last.error) throw last.error;
  const { data, error } = await supabase
    .from('faqs')
    .insert({ ...input, sort_order: (last.data?.[0]?.sort_order ?? 0) + 1 })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

export async function updateFaq(
  supabase: Client,
  id: string,
  input: FaqCreate,
): Promise<DbResult<FaqRow>> {
  const { data, error } = await supabase
    .from('faqs')
    .update(input)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? { ok: true, data } : { ok: false, code: 'NOT_FOUND' };
}

/** Saklar tampil. Aturan jawaban final dicek pada data tersimpan. */
export async function patchFaq(
  supabase: Client,
  id: string,
  patch: FaqPatch,
): Promise<DbResult<FaqRow>> {
  const current = await getRow(supabase, id);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  const details = checkFaq({ ...current, ...patch });
  if (Object.keys(details).length > 0) return { ok: false, code: 'VALIDATION_ERROR', details };
  const { data, error } = await supabase
    .from('faqs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}

export async function deleteFaq(supabase: Client, id: string): Promise<DbResult<{ id: string }>> {
  const { data, error } = await supabase.from('faqs').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data ?? []).length > 0 ? { ok: true, data: { id } } : { ok: false, code: 'NOT_FOUND' };
}

export const reorderFaqs = (supabase: Client, items: { id: string; sort_order: number }[]) =>
  reorderRows(supabase, 'faqs', items, 'FAQ');
