// PublishBar 3 state (mockup Admin-State, bagian 1). Presentasional: status dan aksi
// datang dari pemanggil (`PublishBarHost` menyambungkannya ke /api/admin/publish, F-20).
import Icon from '@/components/ui/Icon';

export type PublishState =
  | { kind: 'ok'; lastPublished: string | null; cooldown?: number }
  | { kind: 'pending'; count: number; cooldown?: number }
  | { kind: 'running'; count: number };

interface Props {
  state: PublishState;
  onPublish?: () => void;
  /** Tautan "Publikasikan ulang" pada state ok (menghapus data tidak tercatat di updated_at). */
  onRepublish?: () => void;
  historyHref?: string;
  changesHref?: string;
}

export default function PublishBar({
  state,
  onPublish,
  onRepublish,
  historyHref = '/admin/publikasi',
  changesHref = '/admin/publikasi#perubahan',
}: Props) {
  if (state.kind === 'running') {
    return (
      <div className="pb pb-run" role="status" aria-live="polite">
        <span className="spin" aria-hidden="true" />
        <span>
          <strong>
            {state.count > 0 ? `Memublikasikan ${state.count} perubahan…` : 'Memublikasikan…'}
          </strong>{' '}
          Jangan tutup halaman ini.
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
        <button
          type="button"
          className="btn"
          onClick={onPublish}
          disabled={(state.cooldown ?? 0) > 0}
        >
          {(state.cooldown ?? 0) > 0 ? `Tunggu ${state.cooldown} dtk` : 'Publikasikan'}
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
      {onRepublish ? (
        <button
          type="button"
          className="btn-o btn-sm"
          onClick={onRepublish}
          disabled={(state.cooldown ?? 0) > 0}
        >
          {(state.cooldown ?? 0) > 0 ? `Tunggu ${state.cooldown} dtk` : 'Publikasikan ulang'}
        </button>
      ) : null}
    </div>
  );
}
