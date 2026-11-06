// PublikasiBar 3 state (mockup Admin-State, bagian 1). Presentasional: status dan aksi
// datang dari pemanggil. Penyambungan ke /api/admin/publish dikerjakan di bagian Publikasi (F-20).
import Icon from '@/components/ui/Icon';

export type PublishState =
  | { kind: 'ok'; lastPublished: string | null }
  | { kind: 'pending'; count: number }
  | { kind: 'running'; count: number };

interface Props {
  state: PublishState;
  onPublish?: () => void;
  historyHref?: string;
  changesHref?: string;
}

export default function PublishBar({
  state,
  onPublish,
  historyHref = '/admin/publikasi',
  changesHref = '#',
}: Props) {
  if (state.kind === 'running') {
    return (
      <div className="pb pb-run" role="status" aria-live="polite">
        <span className="spin" aria-hidden="true" />
        <span>
          <strong>Memublikasikan {state.count} perubahan…</strong> Jangan tutup halaman ini.
        </span>
        <button type="button" className="btn push" disabled>
          Memproses…
        </button>
      </div>
    );
  }
  if (state.kind === 'pending') {
    return (
      <div className="pb pb-wait" role="status">
        <Icon name="alert-circle" size={18} />
        <span>
          <strong>Ada {state.count} perubahan belum dipublikasikan</strong> · Pengunjung masih
          melihat versi sebelumnya.
        </span>
        <a href={changesHref} className="push" style={{ color: '#5E4800', fontWeight: 700 }}>
          Lihat perubahan
        </a>
        <button type="button" className="btn" onClick={onPublish}>
          Publikasikan
        </button>
      </div>
    );
  }
  return (
    <div className="pb pb-ok" role="status">
      <Icon name="check-circle" size={18} />
      <span>
        <strong>Semua perubahan sudah tayang</strong>
        {state.lastPublished ? ` · Publikasi terakhir ${state.lastPublished}` : ''}
      </span>
      <a href={historyHref} className="push" style={{ color: '#22603B', fontWeight: 700 }}>
        Riwayat publikasi
      </a>
    </div>
  );
}
