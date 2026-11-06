// Akses data lead untuk panel admin. Memakai klien sesi admin (RLS berlaku), bukan service role.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { PAGE_SIZE, searchClause, type LeadRow, type LeadStatus, type LeadType } from './leads';

type Client = SupabaseClient<Database>;

export interface LeadFilter {
  type?: LeadType;
  status?: LeadStatus;
  q?: string;
}

function applyFilter<T extends { eq: (c: string, v: string) => T; or: (f: string) => T }>(
  query: T,
  filter: LeadFilter,
): T {
  let next = query;
  if (filter.type) next = next.eq('type', filter.type);
  if (filter.status) next = next.eq('status', filter.status);
  const clause = filter.q ? searchClause(filter.q) : null;
  if (clause) next = next.or(clause);
  return next;
}

export async function listLeads(
  supabase: Client,
  filter: LeadFilter,
  page: number,
): Promise<{ rows: LeadRow[]; total: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await applyFilter(
    supabase.from('leads').select('*', { count: 'exact' }),
    filter,
  )
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

/** Jumlah per jenis dan status (untuk tab dan chip). Satu query ringan. */
export async function leadCounts(
  supabase: Client,
): Promise<Record<LeadType, Record<LeadStatus, number>>> {
  const empty = () => ({ new: 0, contacted: 0, closed: 0, spam: 0 });
  const counts = { academy: empty(), partnership: empty() };
  const { data, error } = await supabase.from('leads').select('type, status').limit(10_000);
  if (error) throw error;
  for (const row of data ?? []) counts[row.type][row.status] += 1;
  return counts;
}

export async function getLead(supabase: Client, id: string): Promise<LeadRow | null> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Semua lead sesuai filter, per 1000 baris, untuk ekspor CSV. */
export async function* iterateLeads(
  supabase: Client,
  filter: LeadFilter,
): AsyncGenerator<LeadRow[]> {
  const batch = 1000;
  for (let from = 0; ; from += batch) {
    const { data, error } = await applyFilter(supabase.from('leads').select('*'), filter)
      .order('created_at', { ascending: false })
      .range(from, from + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) return;
    yield data;
    if (data.length < batch) return;
  }
}
