// PublishBar yang tersambung ke API (PRD F-20), dipasang di AdminLayout supaya tampil di setiap
// layar admin. Status awal datang dari server; setelahnya disegarkan saat konten diubah
// (`admin:content-changed` dari callApi), saat tab kembali aktif, dan tiap menit.
import { useCallback, useEffect, useRef, useState } from 'react';
import PublishBar, { type PublishState } from '@/components/admin/PublishBar';
import { callApi } from '@/lib/admin/client';
import { showToast } from '@/lib/admin/toast';
import { formatPublishTime, type PublishStatus } from '@/lib/admin/publish';
import { useHydrated } from '@/lib/admin/use-hydrated';

type Status = Pick<
  PublishStatus,
  'has_unpublished_changes' | 'pending_count' | 'last_success_at' | 'cooldown_seconds_left'
>;

const POLL_MS = 60_000;
const DEBOUNCE_MS = 500;

export default function PublishBarHost({ initial }: { initial: Status }) {
  const hydrated = useHydrated();
  const [status, setStatus] = useState<Status>(initial);
  const [running, setRunning] = useState(false);
  const [cooldown, setCooldown] = useState(initial.cooldown_seconds_left);
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (runningRef.current) return;
    const result = await callApi<Status>('GET', '/api/admin/publish/status');
    if (!result.success || runningRef.current) return;
    setStatus(result.data);
    setCooldown(result.data.cooldown_seconds_left);
  }, []);

  // Hitung mundur kunci 60 detik.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onChanged = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), DEBOUNCE_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('admin:content-changed', onChanged);
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(onVisible, POLL_MS);
    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      window.removeEventListener('admin:content-changed', onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const publish = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const result = await callApi('POST', '/api/admin/publish');
    runningRef.current = false;
    setRunning(false);
    if (result.success) {
      showToast({
        kind: 'success',
        title: 'Publikasi dipicu',
        message: 'Situs publik diperbarui dalam beberapa menit.',
      });
    } else {
      showToast({
        kind: 'error',
        title: result.error.message,
        action: result.error.code === 'RATE_LIMITED' ? undefined : { label: 'Coba lagi', onClick: () => void publish() },
      });
    }
    await refresh();
  }, [refresh]);

  const state: PublishState = running
    ? { kind: 'running', count: status.pending_count }
    : status.has_unpublished_changes
      ? { kind: 'pending', count: status.pending_count, cooldown }
      : {
          kind: 'ok',
          lastPublished: status.last_success_at ? formatPublishTime(status.last_success_at) : null,
          cooldown,
        };

  return (
    <div data-publishbar data-hydrated={hydrated ? 'true' : 'false'}>
      <PublishBar state={state} onPublish={() => void publish()} onRepublish={() => void publish()} />
    </div>
  );
}
