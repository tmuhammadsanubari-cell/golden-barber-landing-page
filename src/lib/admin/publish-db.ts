// Akses data publikasi (PRD F-20). Status dibaca dengan klien sesi admin (RLS berlaku);
// log publikasi ditulis dengan service role (RLS publish_logs: admin hanya SELECT).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import type { Database } from '@/types/database';
import {
  CONTENT_TABLES,
  PUBLISH_COOLDOWN_SECONDS,
  callDeployHook,
  cooldownSecondsLeft,
  summarizeChanges,
  type ContentTable,
  type PublishLastLog,
  type PublishStatus,
} from './publish';

type Client = SupabaseClient<Database>;

/** Dasar waktu bila belum pernah ada publikasi sukses: waktu pembuatan cabang tertua (= seed; situs awal dibangun dari seed). */
const EPOCH = '1970-01-01T00:00:00.000Z';

async function baselineWithoutPublish(supabase: Client): Promise<string> {
  const { data, error } = await supabase
    .from('branches')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.created_at ?? EPOCH;
}

/** Jumlah baris per tabel konten dengan `updated_at` lebih baru dari `since`. */
export async function countChangesSince(
  supabase: Client,
  since: string,
): Promise<Record<ContentTable, number>> {
  const results = await Promise.all(
    CONTENT_TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gt('updated_at', since);
      if (error) throw error;
      return [table, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<ContentTable, number>;
}

interface LogRow {
  status: 'triggered' | 'failed';
  created_at: string;
  triggered_by: string;
}

/** Nama admin per id. Editor tidak boleh membaca profil lain (RLS), jadi pakai klien service. */
export async function adminNames(
  service: Client,
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const { data, error } = await service
    .from('admin_profiles')
    .select('id, full_name')
    .in('id', unique);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.full_name]));
}

export async function loadPublishStatus(
  supabase: Client,
  service: Client,
  now: Date = new Date(),
): Promise<PublishStatus & { counts: Record<ContentTable, number> }> {
  const [lastAny, lastOk] = await Promise.all([
    supabase
      .from('publish_logs')
      .select('status, created_at, triggered_by')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('publish_logs')
      .select('created_at')
      .eq('status', 'triggered')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (lastAny.error) throw lastAny.error;
  if (lastOk.error) throw lastOk.error;

  const lastSuccessAt = lastOk.data?.[0]?.created_at ?? null;
  const since = lastSuccessAt ?? (await baselineWithoutPublish(supabase));
  const counts = await countChangesSince(supabase, since);
  const { changedTables, total } = summarizeChanges(counts);

  const log = (lastAny.data?.[0] as LogRow | undefined) ?? null;
  let lastPublish: PublishLastLog | null = null;
  if (log) {
    const names = await adminNames(service, [log.triggered_by]);
    lastPublish = {
      status: log.status,
      created_at: log.created_at,
      triggered_by: names[log.triggered_by] ?? null,
    };
  }

  return {
    has_unpublished_changes: total > 0,
    pending_count: total,
    changed_tables: changedTables,
    last_publish: lastPublish,
    last_success_at: lastSuccessAt,
    cooldown_seconds_left: cooldownSecondsLeft(lastSuccessAt, now),
    counts,
  };
}

export interface PublishDeps {
  hookUrl: string | undefined;
  fetchImpl?: typeof fetch;
  now?: Date;
}

export interface PublishResult {
  status: 'triggered';
  created_at: string;
  cooldown_seconds: number;
}

/**
 * Picu Deploy Hook lalu catat ke `publish_logs`.
 * - Dalam 60 detik sejak publikasi sukses terakhir → RATE_LIMITED (hook tidak dipanggil).
 * - Hook gagal / belum diatur → baris `failed` dicatat, PUBLISH_FAILED.
 */
export async function triggerPublish(
  supabase: Client,
  service: Client,
  adminId: string,
  deps: PublishDeps,
): Promise<DbResult<PublishResult>> {
  const now = deps.now ?? new Date();

  const last = await supabase
    .from('publish_logs')
    .select('created_at')
    .eq('status', 'triggered')
    .order('created_at', { ascending: false })
    .limit(1);
  if (last.error) throw last.error;
  const wait = cooldownSecondsLeft(last.data?.[0]?.created_at ?? null, now);
  if (wait > 0) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: `Publikasi baru saja dipicu. Tunggu ${wait} detik lagi.`,
    };
  }

  const outcome = deps.hookUrl
    ? await callDeployHook(deps.hookUrl, deps.fetchImpl)
    : ({ ok: false, code: null, message: 'VERCEL_DEPLOY_HOOK_URL belum diisi' } as const);

  const inserted = await service
    .from('publish_logs')
    .insert({
      triggered_by: adminId,
      status: outcome.ok ? 'triggered' : 'failed',
      response_code: outcome.code,
      error_message: outcome.ok ? null : outcome.message,
    })
    .select('created_at')
    .single();
  // Build sudah terpicu bila hook sukses; kegagalan mencatat tidak boleh menutupi itu.
  if (inserted.error) console.error('[publish] gagal mencatat publish_logs', inserted.error);

  if (!outcome.ok) return { ok: false, code: 'PUBLISH_FAILED' };
  return {
    ok: true,
    data: {
      status: 'triggered',
      created_at: inserted.data?.created_at ?? now.toISOString(),
      cooldown_seconds: PUBLISH_COOLDOWN_SECONDS,
    },
  };
}

export interface PublishHistoryRow {
  id: string;
  status: 'triggered' | 'failed';
  response_code: number | null;
  error_message: string | null;
  created_at: string;
  triggered_by_name: string | null;
}

export async function listPublishHistory(
  supabase: Client,
  service: Client,
  limit = 30,
): Promise<PublishHistoryRow[]> {
  const { data, error } = await supabase
    .from('publish_logs')
    .select('id, status, response_code, error_message, created_at, triggered_by')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const names = await adminNames(
    service,
    rows.map((row) => row.triggered_by),
  );
  return rows.map(({ triggered_by, ...row }) => ({
    ...row,
    triggered_by_name: names[triggered_by] ?? null,
  }));
}
