// Testimoni admin (PRD F-21; tanpa mockup, pola daftar seperti Galeri/Layanan): daftar dengan
// saklar tampil, urut ulang, form tambah/ubah, hapus.
import { useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormDialog from '@/components/admin/FormDialog';
import Icon from '@/components/ui/Icon';
import { callApi } from '@/lib/admin/client';
import { countSummary, overLimit, stars, truncate } from '@/lib/admin/content-view';
import { showToast } from '@/lib/admin/toast';
import { useSortable } from '@/lib/admin/use-sortable';
import { useHydrated } from '@/lib/admin/use-hydrated';
import {
  CONTENT_MAX,
  SOURCES,
  SOURCE_LABEL,
  testimonialCreateSchema,
  type Source,
} from '@/lib/validation/admin-testimonials';

export interface TestimonialItem {
  id: string;
  branch_id: string | null;
  customer_name: string;
  rating: number;
  content: string;
  source: string;
  is_placeholder: boolean;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  initial: TestimonialItem[];
  branches: { id: string; name: string }[];
  /** Testimoni aktif yang tampil di situs (PRD F-11). */
  siteLimit: number;
}

type Dialog = { kind: 'form'; id: string | null } | { kind: 'delete'; id: string } | null;

interface FormValues {
  customer_name: string;
  branch_id: string;
  rating: string;
  source: Source;
  content: string;
  is_placeholder: boolean;
  is_active: boolean;
}

const EMPTY: FormValues = {
  customer_name: '',
  branch_id: '',
  rating: '5',
  source: 'langsung',
  content: '',
  is_placeholder: false,
  is_active: true,
};

const sourceLabel = (source: string) => SOURCE_LABEL[source as Source] ?? source;

export default function TestimonialManager({ initial, branches, siteLimit }: Props) {
  const hydrated = useHydrated();
  const [items, setItems] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const sortable = useSortable({
    items,
    setItems,
    endpoint: '/api/admin/testimonials/reorder',
    label: (item) => item.customer_name,
  });

  const branchName = (id: string | null) =>
    id ? (branches.find((branch) => branch.id === id)?.name ?? 'Cabang') : 'Semua cabang';
  const target = dialog ? (items.find((item) => item.id === dialog.id) ?? null) : null;
  const over = overLimit(items, siteLimit);

  async function toggleActive(item: TestimonialItem) {
    const result = await callApi<TestimonialItem>('PATCH', `/api/admin/testimonials/${item.id}`, {
      is_active: !item.is_active,
    });
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal mengubah tampilan', message: result.error.message });
      return;
    }
    setItems((current) => current.map((row) => (row.id === item.id ? result.data : row)));
    showToast({
      kind: 'success',
      title: item.is_active
        ? `Testimoni ${item.customer_name} disembunyikan`
        : `Testimoni ${item.customer_name} ditampilkan`,
    });
  }

  async function remove(item: TestimonialItem) {
    setBusy(true);
    const result = await callApi('DELETE', `/api/admin/testimonials/${item.id}`);
    setBusy(false);
    setDialog(null);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    showToast({ kind: 'success', title: `Testimoni ${item.customer_name} dihapus` });
  }

  return (
    <div data-hydrated={hydrated ? 'true' : 'false'} data-testimonials>
      <div className="page-head">
        <div>
          <h1 className="h1">Testimoni</h1>
          <p className="page-sub" data-count-summary>
            {countSummary('testimoni', items)}. Seret ⋮⋮ untuk mengatur urutan di situs.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setDialog({ kind: 'form', id: null })}>
          <Icon name="plus" size={18} />
          Tambah Testimoni
        </button>
      </div>

      {over > 0 && (
        <p className="gal-note" role="status">
          Situs hanya menampilkan {siteLimit} testimoni aktif teratas. {over} testimoni aktif di
          urutan bawah tidak tampil.
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {sortable.announce}
      </p>

      {items.length === 0 ? (
        <div className="card empty-state" data-empty>
          <p>Belum ada testimoni. Tambahkan ulasan pelanggan yang sudah mengizinkan dikutip.</p>
        </div>
      ) : (
        <ul className="crud-list" aria-label="Daftar testimoni">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`card crud-row ${item.is_active ? '' : 'off'} ${sortable.rowClass(item.id)}`}
              data-row-id={item.id}
              {...sortable.rowProps(item.id, index)}
            >
              <button
                type="button"
                className="ib grip crud-grip"
                aria-label={`Atur urutan testimoni ${item.customer_name}, urutan ${index + 1} dari ${items.length}. Seret, atau tekan panah atas/bawah.`}
                onKeyDown={(event) => sortable.onHandleKey(event, item.id, index)}
              >
                <Icon name="grip" size={16} />
              </button>
              <div className="crud-main">
                <p className="crud-title">
                  <strong>{item.customer_name}</strong>
                  <span className="crud-meta">{branchName(item.branch_id)}</span>
                  {item.is_placeholder && <span className="bd b-warn">Contoh</span>}
                </p>
                <p className="crud-sub">
                  <span role="img" aria-label={`Rating ${item.rating} dari 5`} className="crud-stars">
                    {stars(item.rating)}
                  </span>
                  <span className="crud-meta">{sourceLabel(item.source)}</span>
                </p>
                <p className="crud-text">{truncate(item.content, 180)}</p>
              </div>
              <div className="crud-side">
                <span className="crud-switch">
                  <button
                    type="button"
                    className={`sw${item.is_active ? ' on' : ''}`}
                    role="switch"
                    aria-checked={item.is_active}
                    aria-label={`Tampilkan testimoni ${item.customer_name} di situs`}
                    onClick={() => void toggleActive(item)}
                  />
                  <span className={`gal-state${item.is_active ? ' on' : ''}`}>
                    {item.is_active ? 'Tampil' : 'Disembunyikan'}
                  </span>
                </span>
                <span className="crud-actions">
                  <button
                    type="button"
                    className="ib only-sm-flex"
                    aria-label={`Naikkan ${item.customer_name}`}
                    disabled={index === 0}
                    onClick={() => sortable.move(item.id, index - 1)}
                  >
                    <Icon name="arrow-up" size={17} />
                  </button>
                  <button
                    type="button"
                    className="ib only-sm-flex"
                    aria-label={`Turunkan ${item.customer_name}`}
                    disabled={index === items.length - 1}
                    onClick={() => sortable.move(item.id, index + 1)}
                  >
                    <Icon name="arrow-down" size={17} />
                  </button>
                  <button
                    type="button"
                    className="ib"
                    aria-label={`Edit testimoni ${item.customer_name}`}
                    onClick={() => setDialog({ kind: 'form', id: item.id })}
                  >
                    <Icon name="edit" size={17} />
                  </button>
                  <button
                    type="button"
                    className="ib dng"
                    aria-label={`Hapus testimoni ${item.customer_name}`}
                    onClick={() => setDialog({ kind: 'delete', id: item.id })}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TestimonialDialog
        key={dialog?.kind === 'form' ? `form-${dialog.id ?? 'baru'}` : 'closed'}
        open={dialog?.kind === 'form'}
        item={dialog?.kind === 'form' ? target : null}
        branches={branches}
        onClose={() => setDialog(null)}
        onSaved={(saved, created) => {
          setItems((current) =>
            created ? [...current, saved] : current.map((row) => (row.id === saved.id ? saved : row)),
          );
          setDialog(null);
          showToast({
            kind: 'success',
            title: created ? 'Testimoni ditambahkan' : 'Testimoni disimpan',
          });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete' && target !== null}
        title={`Hapus testimoni ${target?.customer_name ?? ''}?`}
        description="Testimoni dihapus permanen dan tidak dapat dibatalkan. Jika hanya tidak ingin ditampilkan, sembunyikan saja."
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

function TestimonialDialog({
  open,
  item,
  branches,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: TestimonialItem | null;
  branches: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (item: TestimonialItem, created: boolean) => void;
}) {
  const [values, setValues] = useState<FormValues>(
    item
      ? {
          customer_name: item.customer_name,
          branch_id: item.branch_id ?? '',
          rating: String(item.rating),
          source: item.source as Source,
          content: item.content,
          is_placeholder: item.is_placeholder,
          is_active: item.is_active,
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  async function submit() {
    const parsed = testimonialCreateSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    const result = item
      ? await callApi<TestimonialItem>('PUT', `/api/admin/testimonials/${item.id}`, parsed.data)
      : await callApi<TestimonialItem>('POST', '/api/admin/testimonials', parsed.data);
    setBusy(false);
    if (!result.success) {
      setErrors({ ...result.error.details, _: result.error.message });
      return;
    }
    onSaved(result.data, !item);
  }

  const field = (key: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label className="fl" htmlFor={`tst-${key}`}>
        {label}
      </label>
      {input}
      {errors[key] ? (
        <p className="ferr" role="alert">
          {errors[key]}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <FormDialog
      open={open}
      icon="star"
      title={item ? `Edit testimoni ${item.customer_name}` : 'Tambah testimoni'}
      description="Masukkan ulasan hanya dengan izin penulisnya atau dalam bentuk parafrasa. Tidak menyalin ulasan secara massal."
      submitLabel={item ? 'Simpan Perubahan' : 'Simpan Testimoni'}
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {field(
        'customer_name',
        'Nama pelanggan',
        <input
          id="tst-customer_name"
          className={`inp${errors.customer_name ? ' err' : ''}`}
          maxLength={60}
          value={values.customer_name}
          onChange={(event) => set('customer_name', event.target.value)}
        />,
        'Disarankan inisial nama belakang, mis. "Rizky A."',
      )}
      {field(
        'branch_id',
        'Cabang',
        <select
          id="tst-branch_id"
          className="sel"
          value={values.branch_id}
          onChange={(event) => set('branch_id', event.target.value)}
        >
          <option value="">Semua cabang</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>,
      )}
      <div className="crud-two">
        {field(
          'rating',
          'Rating',
          <select
            id="tst-rating"
            className="sel"
            value={values.rating}
            onChange={(event) => set('rating', event.target.value)}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} · {stars(n)}
              </option>
            ))}
          </select>,
        )}
        {field(
          'source',
          'Sumber',
          <select
            id="tst-source"
            className="sel"
            value={values.source}
            onChange={(event) => set('source', event.target.value as Source)}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABEL[source]}
              </option>
            ))}
          </select>,
        )}
      </div>
      {field(
        'content',
        'Isi testimoni',
        <textarea
          id="tst-content"
          className={`inp${errors.content ? ' err' : ''}`}
          rows={4}
          maxLength={CONTENT_MAX}
          value={values.content}
          onChange={(event) => set('content', event.target.value)}
        />,
        `${values.content.length}/${CONTENT_MAX} karakter`,
      )}
      <label className="gal-check">
        <input
          type="checkbox"
          checked={values.is_placeholder}
          onChange={(event) => set('is_placeholder', event.target.checked)}
        />
        <span>Konten contoh (belum ulasan asli; wajib diganti sebelum launch)</span>
      </label>
      <label className="gal-check">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(event) => set('is_active', event.target.checked)}
        />
        <span>Tampilkan di situs</span>
      </label>
      {errors._ && (
        <p className="ferr" role="alert">
          {errors._}
        </p>
      )}
    </FormDialog>
  );
}
