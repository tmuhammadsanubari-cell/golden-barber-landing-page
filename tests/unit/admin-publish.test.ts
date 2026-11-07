import { describe, expect, it, vi } from 'vitest';
import {
  PUBLISH_COOLDOWN_SECONDS,
  callDeployHook,
  cooldownSecondsLeft,
  formatPublishTime,
  summarizeChanges,
} from '@/lib/admin/publish';

const HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_x/RAHASIA';

describe('cooldownSecondsLeft', () => {
  const now = new Date('2026-11-07T10:00:00Z');
  it('tanpa publikasi sebelumnya → 0', () => {
    expect(cooldownSecondsLeft(null, now)).toBe(0);
  });
  it('baru saja → penuh 60 detik', () => {
    expect(cooldownSecondsLeft('2026-11-07T10:00:00Z', now)).toBe(PUBLISH_COOLDOWN_SECONDS);
  });
  it('20 detik lalu → 40', () => {
    expect(cooldownSecondsLeft('2026-11-07T09:59:40Z', now)).toBe(40);
  });
  it('tepat 60 detik atau lebih → 0', () => {
    expect(cooldownSecondsLeft('2026-11-07T09:59:00Z', now)).toBe(0);
    expect(cooldownSecondsLeft('2026-11-07T08:00:00Z', now)).toBe(0);
  });
  it('waktu di masa depan (selisih jam) tidak melebihi 60', () => {
    expect(cooldownSecondsLeft('2026-11-07T10:05:00Z', now)).toBe(PUBLISH_COOLDOWN_SECONDS);
  });
  it('tanggal rusak → 0', () => {
    expect(cooldownSecondsLeft('bukan tanggal', now)).toBe(0);
  });
});

describe('summarizeChanges', () => {
  it('hanya tabel berubah, urutan tetap, total dijumlah', () => {
    expect(summarizeChanges({ faqs: 2, barbers: 3, services: 0 })).toEqual({
      changedTables: ['barbers', 'faqs'],
      total: 5,
    });
  });
  it('kosong → tidak ada perubahan', () => {
    expect(summarizeChanges({})).toEqual({ changedTables: [], total: 0 });
  });
});

describe('formatPublishTime', () => {
  it('WIB, format Indonesia', () => {
    expect(formatPublishTime('2026-11-07T07:05:00Z')).toMatch(/^7 Nov(?:\.|ember)? 2026, 14\.05$/);
  });
  it('tanggal rusak → string kosong', () => {
    expect(formatPublishTime('x')).toBe('');
  });
});

describe('callDeployHook', () => {
  it('2xx → sukses dengan kode', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 201 }));
    expect(await callDeployHook(HOOK, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: true,
      code: 201,
    });
    expect(fetchImpl).toHaveBeenCalledWith(HOOK, expect.objectContaining({ method: 'POST' }));
  });
  it('non-2xx → gagal dengan kode', async () => {
    const fetchImpl = async () => new Response('', { status: 500 });
    const result = await callDeployHook(HOOK, fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, code: 500 });
  });
  it('jaringan putus → gagal tanpa kode, URL tidak bocor di pesan', async () => {
    const fetchImpl = async () => {
      throw new TypeError(`fetch failed ${HOOK}`);
    };
    const result = await callDeployHook(HOOK, fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, code: null });
    if (!result.ok) expect(result.message).not.toContain('RAHASIA');
  });
  it('timeout → pesan khusus', async () => {
    const fetchImpl = async () => {
      throw new DOMException('timed out', 'TimeoutError');
    };
    const result = await callDeployHook(HOOK, fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, code: null });
    if (!result.ok) expect(result.message).toMatch(/timeout/);
  });
});
