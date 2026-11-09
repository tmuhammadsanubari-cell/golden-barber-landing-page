// Galeri admin (PRD F-21, mockup Admin-Galeri): dropzone, antrean unggah dengan progres dan galat,
// grid kartu dengan judul inline, saklar tampil, urut ulang (seret / panah keyboard / tombol
// naik-turun di layar sentuh), ganti gambar, detail (deskripsi, alt text, label ilustrasi), hapus.
import { useRef, useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormDialog from '@/components/admin/FormDialog';
import Icon from '@/components/ui/Icon';
import { moveItem } from '@/lib/admin/branches';
import { callApi } from '@/lib/admin/client';
import {
  gallerySummary,
  hiddenByLimit,
  titleFromFilename,
  type GalleryItem,
} from '@/lib/admin/gallery';
import { showToast } from '@/lib/admin/toast';
import { uploadImage } from '@/lib/admin/upload-client';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { formatBytes, mediaUrl } from '@/lib/media';
import { galleryPatchSchema } from '@/lib/validation/admin-gallery';

interface Props {
  initial: GalleryItem[];
  /** Jumlah item aktif yang tampil di situs (PRD F-10). */
  siteLimit: number;
}

type QueueEntry = {
  key: number;
  file: File;
  progress: number;
  error: string | null;
};

type Dialog = { kind: 'detail' | 'delete'; id: string } | null;

let nextKey = 1;

export default function GalleryManager({ initial, siteLimit }: Props) {
  const hydrated = useHydrated();
  const [items, setItems] = useState(initial);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [announce, setAnnounce] = useState('');
  const replaceFor = useRef<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const target = dialog ? (items.find((item) => item.id === dialog.id) ?? null) : null;

  // ---- unggah baru ----------------------------------------------------------------------

  const patchQueue = (key: number, change: Partial<QueueEntry>) =>
    setQueue((current) => current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));

  async function processEntry(entry: QueueEntry) {
    patchQueue(entry.key, { error: null, progress: 0 });
    const uploaded = await uploadImage(entry.file, 'gallery', (progress) =>
      patchQueue(entry.key, { progress }),
    );
    if (!uploaded.ok) {
      patchQueue(entry.key, { error: uploaded.message });
      return;
    }
    // Item baru nonaktif sampai alt text diisi (PRD F-21): admin melengkapi lalu menayangkan.
    const created = await callApi<GalleryItem>('POST', '/api/admin/gallery', {
      title: titleFromFilename(entry.file.name),
      image_path: uploaded.image.path,
      alt_text: '',
      is_active: false,
      is_placeholder: false,
    });
    if (!created.success) {
      patchQueue(entry.key, { error: created.error.message });
      return;
    }
    setQueue((current) => current.filter((row) => row.key !== entry.key));
    setItems((current) => [...current, created.data]);
    showToast({
      kind: 'success',
      title: `${created.data.title} ditambahkan`,
      message: 'Isi alt text lalu aktifkan agar tampil di situs.',
      action: { label: 'Isi alt text', onClick: () => setDialog({ kind: 'detail', id: created.data.id }) },
    });
  }

  function addFiles(files: File[]) {
    const entries = files.map((file) => ({ key: nextKey++, file, progress: 0, error: null }));
    if (entries.length === 0) return;
    setQueue((current) => [...current, ...entries]);
    for (const entry of entries) void processEntry(entry);
  }

  // ---- ubah item --------------------------------------------------------------------------

  /** Simpan sebagian field. Mengembalikan pesan galat (atau null bila sukses). */
  async function patch(item: GalleryItem, change: Record<string, unknown>): Promise<string | null> {
    const parsed = galleryPatchSchema.safeParse(change);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Data belum valid.';
    const result = await callApi<GalleryItem>('PATCH', `/api/admin/gallery/${item.id}`, parsed.data);
    if (!result.success) return Object.values(result.error.details)[0] ?? result.error.message;
    setItems((current) => current.map((row) => (row.id === item.id ? result.data : row)));
    return null;
  }

  async function toggleActive(item: GalleryItem) {
    const message = await patch(item, { is_active: !item.is_active });
    if (message) {
      showToast({
        kind: 'error',
        title: 'Gagal mengubah tampilan',
        message,
        action: { label: 'Isi alt text', onClick: () => setDialog({ kind: 'detail', id: item.id }) },
      });
      return;
    }
    showToast({
      kind: 'success',
      title: item.is_active ? `${item.title} disembunyikan` : `${item.title} ditampilkan`,
    });
  }

  async function replaceImage(item: GalleryItem, file: File) {
    showToast({ kind: 'success', title: 'Mengunggah gambar pengganti…' });
    const uploaded = await uploadImage(file, 'gallery');
    if (!uploaded.ok) {
      showToast({ kind: 'error', title: 'Gagal mengganti gambar', message: uploaded.message });
      return;
    }
    const result = await callApi<GalleryItem>('PUT', `/api/admin/gallery/${item.id}`, {
      title: item.title,
      description: item.description,
      alt_text: item.alt_text,
      is_placeholder: item.is_placeholder,
      is_active: item.is_active,
      image_path: uploaded.image.path,
    });
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal mengganti gambar', message: result.error.message });
      return;
    }
    setItems((current) => current.map((row) => (row.id === item.id ? result.data : row)));
    showToast({ kind: 'success', title: `Gambar ${item.title} diganti` });
  }

  async function remove(item: GalleryItem) {
    setBusy(true);
    const result = await callApi('DELETE', `/api/admin/gallery/${item.id}`);
    setBusy(false);
    setDialog(null);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    showToast({ kind: 'success', title: `${item.title} dihapus` });
  }

  // ---- urutan -----------------------------------------------------------------------------

  async function persistOrder(next: GalleryItem[], message: string) {
    const previous = items;
    setItems(next.map((item, index) => ({ ...item, sort_order: index + 1 })));
    const result = await callApi(
      'PATCH',
      '/api/admin/gallery/reorder',
      next.map((item, index) => ({ id: item.id, sort_order: index + 1 })),
    );
    if (!result.success) {
      setItems(previous);
      showToast({ kind: 'error', title: 'Urutan gagal disimpan', message: result.error.message });
      return;
    }
    setAnnounce(message);
    showToast({ kind: 'success', title: 'Urutan disimpan' });
  }

  function move(id: string, to: number) {
    const from = items.findIndex((item) => item.id === id);
    if (from === -1 || to < 0 || to >= items.length || from === to) return;
    void persistOrder(
      moveItem(items, from, to),
      `${items[from]!.title} dipindah ke urutan ${to + 1} dari ${items.length}.`,
    );
  }

  function onHandleKey(event: React.KeyboardEvent, id: string, index: number) {
    const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    move(id, index + step);
  }

  const over = hiddenByLimit(items, siteLimit);

  return (
    <div data-hydrated={hydrated ? 'true' : 'false'} data-gallery>
      <div className="page-head">
        <div>
          <h1 className="h1">Galeri Model Rambut</h1>
          <p className="page-sub" data-gallery-summary>
            {gallerySummary(items)}. Seret ⋮⋮ untuk mengatur urutan di situs.
          </p>
        </div>
      </div>

      <label
        className={`gal-drop${dropping ? ' over' : ''}`}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          setDropping(false);
          addFiles([...event.dataTransfer.files]);
        }}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="gal-file"
          aria-label="Pilih file gambar"
          data-gallery-input
          onChange={(event) => {
            addFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
        <span className="gal-drop-icon" aria-hidden="true">
          <Icon name="upload" size={26} />
        </span>
        <span className="gal-drop-text">
          <strong>
            Tarik &amp; lepas gambar di sini, atau <u>pilih file</u>
          </strong>
          <span>JPG, PNG, atau WebP · maks. 3 MB per file · disarankan rasio 1:1, minimal 800×800 px</span>
        </span>
        <span className="btn gal-drop-btn" aria-hidden="true">
          Pilih File
        </span>
      </label>

      {queue.length > 0 && (
        <div className="card gal-queue" data-gallery-queue>
          {queue.map((entry) => (
            <div key={entry.key} className="gal-q-row" data-queue-name={entry.file.name}>
              {entry.error ? (
                <span className="gal-q-thumb gal-q-err" aria-hidden="true">
                  <Icon name="info" size={20} />
                </span>
              ) : (
                <span className="gal-q-thumb ph" aria-hidden="true" />
              )}
              <div className="gal-q-main">
                <strong>{entry.file.name}</strong>
                {entry.error ? (
                  <p role="alert" className="gal-q-msg err">
                    {entry.error}
                  </p>
                ) : (
                  <p className="gal-q-msg">{formatBytes(entry.file.size)} · mengunggah…</p>
                )}
              </div>
              {entry.error ? (
                <span className="gal-q-actions">
                  {!entry.error.startsWith('File terlalu besar') && !entry.error.startsWith('Format') && (
                    <button type="button" className="btn-o btn-sm" onClick={() => void processEntry(entry)}>
                      Coba lagi
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-o btn-sm"
                    onClick={() => setQueue((current) => current.filter((row) => row.key !== entry.key))}
                  >
                    Tutup
                  </button>
                </span>
              ) : (
                <>
                  <div
                    className="gal-bar"
                    role="progressbar"
                    aria-valuenow={entry.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progres unggah ${entry.file.name}`}
                  >
                    <div style={{ width: `${entry.progress}%` }} />
                  </div>
                  <span className="gal-q-pct">{entry.progress}%</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {over > 0 && (
        <p className="gal-note" role="status">
          Situs hanya menampilkan {siteLimit} gambar aktif teratas. {over} gambar aktif di urutan
          bawah tidak tampil.
        </p>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {items.length === 0 ? (
        <div className="card empty-state" data-gallery-empty>
          <p>Belum ada gambar. Unggah foto model rambut lewat kotak di atas.</p>
        </div>
      ) : (
        <ul className="gal-grid" aria-label="Daftar gambar galeri">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={[
                'card',
                'gal-card',
                item.is_active ? '' : 'off',
                dragId === item.id ? 'dragging' : '',
                overId === item.id && dragId !== item.id ? 'drop-target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-gallery-id={item.id}
              draggable
              onDragStart={(event) => {
                setDragId(item.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.id);
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                setOverId(item.id);
              }}
              onDrop={(event) => {
                if (!dragId) return;
                event.preventDefault();
                if (dragId !== item.id) move(dragId, index);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              <div className="gal-img">
                <img
                  src={mediaUrl(item.image_path)}
                  alt={item.alt_text || `Gambar ${item.title}`}
                  loading="lazy"
                  draggable={false}
                />
                <button
                  type="button"
                  className="ib grip gal-grip"
                  aria-label={`Atur urutan ${item.title}, urutan ${index + 1} dari ${items.length}. Seret, atau tekan panah.`}
                  onKeyDown={(event) => onHandleKey(event, item.id, index)}
                >
                  <Icon name="grip" size={16} />
                </button>
                {item.is_placeholder && <span className="tag gal-tag">Ilustrasi</span>}
                <span className="gal-no">#{index + 1}</span>
              </div>
              <div className="gal-body">
                <TitleField item={item} onCommit={(title) => patch(item, { title })} />
                <div className="gal-row">
                  <button
                    type="button"
                    className={`sw${item.is_active ? ' on' : ''}`}
                    role="switch"
                    aria-checked={item.is_active}
                    aria-label={`Tampilkan ${item.title} di situs`}
                    onClick={() => void toggleActive(item)}
                  />
                  <span className={`gal-state${item.is_active ? ' on' : ''}`}>
                    {item.is_active ? 'Tampil' : 'Disembunyikan'}
                  </span>
                  <span className="gal-actions">
                    <button
                      type="button"
                      className="ib only-sm-flex"
                      aria-label={`Naikkan ${item.title}`}
                      disabled={index === 0}
                      onClick={() => move(item.id, index - 1)}
                    >
                      <Icon name="arrow-up" size={17} />
                    </button>
                    <button
                      type="button"
                      className="ib only-sm-flex"
                      aria-label={`Turunkan ${item.title}`}
                      disabled={index === items.length - 1}
                      onClick={() => move(item.id, index + 1)}
                    >
                      <Icon name="arrow-down" size={17} />
                    </button>
                    <button
                      type="button"
                      className="ib"
                      aria-label={`Detail ${item.title}`}
                      onClick={() => setDialog({ kind: 'detail', id: item.id })}
                    >
                      <Icon name="edit" size={17} />
                    </button>
                    <button
                      type="button"
                      className="ib"
                      aria-label={`Ganti gambar ${item.title}`}
                      onClick={() => {
                        replaceFor.current = item.id;
                        replaceInput.current?.click();
                      }}
                    >
                      <Icon name="image" size={17} />
                    </button>
                    <button
                      type="button"
                      className="ib dng"
                      aria-label={`Hapus ${item.title}`}
                      onClick={() => setDialog({ kind: 'delete', id: item.id })}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </span>
                </div>
                {!item.alt_text.trim() && (
                  <p className="gal-warn">Alt text belum diisi. Wajib sebelum bisa ditampilkan.</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={replaceInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="gal-file"
        tabIndex={-1}
        aria-hidden="true"
        data-gallery-replace
        onChange={(event) => {
          const file = event.target.files?.[0];
          const item = items.find((row) => row.id === replaceFor.current);
          event.target.value = '';
          if (file && item) void replaceImage(item, file);
        }}
      />

      <DetailDialog
        key={`${target?.id ?? 'none'}-${dialog?.kind === 'detail'}`}
        open={dialog?.kind === 'detail' && target !== null}
        item={target}
        onClose={() => setDialog(null)}
        onSave={async (change) => {
          if (!target) return null;
          const message = await patch(target, change);
          if (!message) {
            setDialog(null);
            showToast({ kind: 'success', title: 'Detail gambar disimpan' });
          }
          return message;
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete' && target !== null}
        title={`Hapus ${target?.title ?? 'gambar'}?`}
        description={`${target?.title ?? 'Gambar ini'} dihapus dari galeri dan berkas fotonya dihapus dari penyimpanan. Tindakan ini tidak dapat dibatalkan. Jika hanya tidak ingin ditampilkan, sembunyikan saja.`}
        confirmLabel="Hapus"
        secondary={
          target?.is_active
            ? {
                label: 'Sembunyikan saja',
                onClick: () => {
                  const item = target;
                  setDialog(null);
                  void toggleActive(item);
                },
              }
            : undefined
        }
        busy={busy}
        onConfirm={() => target && void remove(target)}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

/** Judul inline: simpan saat blur/Enter, Escape membatalkan (tanpa blur() manual, lihat PROGRESS). */
function TitleField({
  item,
  onCommit,
}: {
  item: GalleryItem;
  onCommit: (title: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(item.title);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(item.title);
  if (item.title !== lastSaved) {
    setLastSaved(item.title);
    setDraft(item.title);
  }

  async function commit() {
    const text = draft.trim();
    if (text === item.title) {
      setDraft(item.title);
      setError(null);
      return;
    }
    const message = await onCommit(text);
    if (message) setError(message);
    else setError(null);
  }

  return (
    <div>
      <label className="sr-only" htmlFor={`gal-t-${item.id}`}>
        Judul gaya {item.title}
      </label>
      <input
        id={`gal-t-${item.id}`}
        className={`gal-title${error ? ' err' : ''}`}
        value={draft}
        maxLength={80}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            setDraft(item.title);
            setError(null);
          }
        }}
      />
      {error && (
        <p className="ferr" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DetailDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: GalleryItem | null;
  onClose: () => void;
  onSave: (change: Record<string, unknown>) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [alt, setAlt] = useState(item?.alt_text ?? '');
  const [placeholder, setPlaceholder] = useState(item?.is_placeholder ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  async function submit() {
    setBusy(true);
    const message = await onSave({
      title,
      description,
      alt_text: alt,
      is_placeholder: placeholder,
    });
    setBusy(false);
    setError(message);
  }

  return (
    <FormDialog
      open={open}
      icon="image"
      title={`Detail ${item.title}`}
      description="Alt text dibaca pembaca layar dan tampil bila gambar gagal dimuat. Wajib diisi sebelum gambar ditampilkan di situs."
      submitLabel="Simpan"
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div>
        <label className="fl" htmlFor="gal-d-title">
          Judul gaya
        </label>
        <input
          id="gal-d-title"
          className="inp"
          maxLength={80}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div>
        <label className="fl" htmlFor="gal-d-desc">
          Deskripsi (opsional)
        </label>
        <textarea
          id="gal-d-desc"
          className="inp"
          rows={3}
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="hint">{description.length}/300 karakter</p>
      </div>
      <div>
        <label className="fl" htmlFor="gal-d-alt">
          Alt text
        </label>
        <input
          id="gal-d-alt"
          className={`inp${error ? ' err' : ''}`}
          maxLength={200}
          value={alt}
          placeholder="Mis. Foto model rambut French Crop dari samping"
          onChange={(event) => setAlt(event.target.value)}
        />
        {error && (
          <p className="ferr" role="alert">
            {error}
          </p>
        )}
      </div>
      <label className="gal-check">
        <input
          type="checkbox"
          checked={placeholder}
          onChange={(event) => setPlaceholder(event.target.checked)}
        />
        <span>Foto ilustrasi/contoh (tampil dengan label &quot;Ilustrasi&quot; di situs)</span>
      </label>
    </FormDialog>
  );
}
