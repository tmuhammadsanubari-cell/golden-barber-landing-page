// Barber & Harga (PRD F-17, D-09): pilih cabang, edit inline dengan simpan otomatis, harga coret,
// By Barber, aktif, urut ulang, tambah, hapus, pindah cabang, dan salin harga dari barber lain.
// Tabel (desktop) dan kartu (mobile) dirender bersamaan dan berbagi satu state; CSS memilih salah satu.
import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormDialog from '@/components/admin/FormDialog';
import { InlineText, PriceField, type CommitResult } from '@/components/admin/InlineFields';
import Icon from '@/components/ui/Icon';
import {
  PRICE_FIELDS,
  branchOptionLabel,
  filterBarbers,
  parsePriceCell,
  priceSummary,
  summaryText,
  type BarberItem,
  type BranchOption,
  type PriceKey,
} from '@/lib/admin/barbers';
import { moveItem } from '@/lib/admin/branches';
import { callApi } from '@/lib/admin/client';
import { showToast } from '@/lib/admin/toast';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { barberCreateSchema } from '@/lib/validation/admin-barbers';

interface Props {
  branches: BranchOption[];
  branchId: string;
  items: BarberItem[];
}

type Dialog =
  | { kind: 'add' }
  | { kind: 'move'; id: string }
  | { kind: 'copy'; id: string }
  | { kind: 'delete'; id: string }
  | null;

type FieldPatch = Partial<
  Pick<
    BarberItem,
    | 'name'
    | 'label'
    | 'is_generic'
    | 'is_active'
    | 'haircut_price'
    | 'haircut_original_price'
    | 'long_trim_price'
    | 'long_trim_original_price'
  >
>;

const firstMessage = (details: Record<string, string>, fallback: string) =>
  Object.values(details)[0] ?? fallback;

export default function BarberManager({ branches, branchId, items: initial }: Props) {
  const hydrated = useHydrated();
  const branch = branches.find((b) => b.id === branchId)!;
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Record<string, true>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(() => setItems(initial), [initial]);

  const visible = filterBarbers(items, query);
  const canReorder = query.trim() === '';
  const target = dialog && 'id' in dialog ? (items.find((i) => i.id === dialog.id) ?? null) : null;

  function flash(key: string) {
    setSaved((current) => ({ ...current, [key]: true }));
    setTimeout(
      () =>
        setSaved((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        }),
      2500,
    );
  }

  /** PATCH satu/beberapa field. Mengembalikan null bila sukses, atau pesan galat untuk ditampilkan di sel. */
  async function patch(id: string, body: FieldPatch, key: string): CommitResult {
    const result = await callApi<BarberItem>('PATCH', `/api/admin/barbers/${id}`, body);
    if (!result.success) return firstMessage(result.error.details, result.error.message);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...result.data } : item)),
    );
    flash(key);
    return null;
  }

  async function toggle(item: BarberItem, field: 'is_generic' | 'is_active') {
    const message = await patch(item.id, { [field]: !item[field] }, `${item.id}:${field}`);
    if (message) showToast({ kind: 'error', title: 'Gagal menyimpan', message });
  }

  async function persistOrder(next: BarberItem[], previous: BarberItem[], message: string) {
    setItems(next);
    const result = await callApi(
      'PATCH',
      '/api/admin/barbers/reorder',
      next.map((item, index) => ({
        id: item.id,
        sort_order: index + 1,
      })),
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
      items,
      `${items[from]!.name} dipindah ke urutan ${to + 1} dari ${items.length}.`,
    );
  }

  function onHandleKey(event: React.KeyboardEvent, id: string, index: number) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(id, index - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(id, index + 1);
    }
  }

  async function remove(item: BarberItem) {
    setBusy(true);
    const result = await callApi('DELETE', `/api/admin/barbers/${item.id}`);
    setBusy(false);
    setDialog(null);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    showToast({ kind: 'success', title: `${item.name} dihapus` });
  }

  const priceFields = (item: BarberItem, variant: 'cell' | 'field') =>
    PRICE_FIELDS.map((field) => (
      <PriceField
        key={field.key}
        id={`${variant === 'cell' ? 'd' : 'm'}-${item.id}-${field.key}`}
        label={field.label}
        barberName={item.name}
        value={item[field.key]}
        required={field.required}
        strike={field.strike}
        variant={variant}
        saved={Boolean(saved[`${item.id}:${field.key}`])}
        error={null}
        onCommit={(value) => patch(item.id, { [field.key]: value }, `${item.id}:${field.key}`)}
      />
    ));

  const nameFields = (item: BarberItem, prefix: 'd' | 'm') => (
    <>
      <InlineText
        id={`${prefix}-${item.id}-name`}
        value={item.name}
        placeholder="Nama barber"
        ariaLabel={`nama barber ${item.name}`}
        maxLength={60}
        required
        bold
        saved={Boolean(saved[`${item.id}:name`])}
        error={null}
        onCommit={(value) => patch(item.id, { name: value }, `${item.id}:name`)}
      />
      {item.is_generic && (
        <InlineText
          id={`${prefix}-${item.id}-label`}
          value={item.label ?? ''}
          placeholder="+ label (mis. Tier 1)"
          ariaLabel={`label ${item.name}`}
          maxLength={40}
          saved={Boolean(saved[`${item.id}:label`])}
          error={null}
          onCommit={(value) =>
            patch(item.id, { label: value === '' ? null : value }, `${item.id}:label`)
          }
        />
      )}
    </>
  );

  const actionButtons = (item: BarberItem) => (
    <>
      <button
        type="button"
        className="ib"
        aria-label={`Salin harga ke ${item.name} dari barber lain`}
        title="Salin harga dari barber lain"
        disabled={items.length < 2}
        onClick={() => setDialog({ kind: 'copy', id: item.id })}
      >
        <Icon name="copy" size={18} />
      </button>
      <button
        type="button"
        className="ib"
        aria-label={`Pindah ${item.name} ke cabang lain`}
        title="Pindah cabang"
        disabled={branches.length < 2}
        onClick={() => setDialog({ kind: 'move', id: item.id })}
      >
        <Icon name="move" size={18} />
      </button>
      <button
        type="button"
        className="ib dng"
        aria-label={`Hapus ${item.name}`}
        title="Hapus"
        onClick={() => setDialog({ kind: 'delete', id: item.id })}
      >
        <Icon name="trash" size={18} />
      </button>
    </>
  );

  const switchEl = (item: BarberItem, field: 'is_generic' | 'is_active', label: string) => (
    <button
      type="button"
      className={`sw${item[field] ? ' on' : ''}`}
      role="switch"
      aria-checked={item[field]}
      aria-label={label}
      onClick={() => void toggle(item, field)}
    />
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Barber &amp; Harga</h1>
          <p className="page-sub">
            Klik harga untuk mengubah. Perubahan tersimpan otomatis sebagai draf, lalu tekan
            Publikasikan agar tayang.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setDialog({ kind: 'add' })}>
          <Icon name="plus" size={16} />
          Tambah Barber
        </button>
      </div>

      <div className="card toolbar" data-hydrated={String(hydrated)}>
        <div className="toolbar-branch">
          <label htmlFor="bb-cab" className="lbl" style={{ display: 'block', marginBottom: 6 }}>
            Cabang
          </label>
          <select
            id="bb-cab"
            className="inp"
            value={branchId}
            onChange={(event) => {
              const next = branches.find((b) => b.id === event.target.value);
              if (next) window.location.assign(`/admin/barber?cabang=${next.slug}`);
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchOptionLabel(b)}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-search">
          <label htmlFor="bb-q" className="lbl" style={{ display: 'block', marginBottom: 6 }}>
            Cari
          </label>
          <div className="search" style={{ width: '100%', marginLeft: 0 }}>
            <input
              id="bb-q"
              className="inp"
              type="search"
              placeholder="Nama barber…"
              maxLength={60}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Icon name="search" size={18} />
          </div>
        </div>
        <p className="toolbar-sum">
          <strong>{summaryText(items)}</strong>
          <span> · harga dalam ribuan (K)</span>
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {items.length === 0 ? (
        <div className="card empty-state">
          <span aria-hidden="true" className="empty-icon">
            <Icon name="scissors" size={26} />
          </span>
          <p className="h3">Belum ada barber di {branch.name}</p>
          <p className="muted" style={{ margin: 0, maxWidth: 380, lineHeight: 1.55, fontSize: 14 }}>
            Tambahkan barber beserta harganya agar pricelist cabang ini tampil di situs.
          </p>
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'add' })}>
            Tambah Barber
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty-state">
          <p className="h3">Tidak ada barber yang cocok</p>
          <button type="button" className="btn-o" onClick={() => setQuery('')}>
            Hapus pencarian
          </button>
        </div>
      ) : (
        <>
          <div className="card only-lg" style={{ overflow: 'hidden' }}>
            <div role="table" aria-label={`Barber dan harga cabang ${branch.name}`}>
              <div role="row" className="thr barber-grid">
                <span role="columnheader">
                  <span className="sr-only">Urutan</span>
                </span>
                <span role="columnheader">Nama</span>
                <span role="columnheader" className="r">
                  Haircut Reguler
                </span>
                <span role="columnheader" className="r">
                  Harga Coret
                </span>
                <span role="columnheader" className="r">
                  Long Trim
                </span>
                <span role="columnheader" className="r">
                  Harga Coret LT
                </span>
                <span role="columnheader" className="c">
                  By Barber
                </span>
                <span role="columnheader" className="c">
                  Aktif
                </span>
                <span role="columnheader" className="r">
                  Aksi
                </span>
              </div>
              {visible.map((item) => {
                const index = items.findIndex((row) => row.id === item.id);
                return (
                  <div
                    key={item.id}
                    role="row"
                    className={[
                      'tr',
                      'barber-grid',
                      item.is_active ? '' : 'off',
                      dragId === item.id ? 'dragging' : '',
                      overId === item.id && dragId !== item.id ? 'drop-target' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-barber-id={item.id}
                    draggable={canReorder}
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
                      event.preventDefault();
                      if (dragId && dragId !== item.id) move(dragId, index);
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                  >
                    <span role="cell">
                      {canReorder && (
                        <button
                          type="button"
                          className="ib grip"
                          aria-label={`Atur urutan ${item.name}, urutan ${index + 1} dari ${items.length}. Seret, atau tekan panah atas/bawah.`}
                          onKeyDown={(event) => onHandleKey(event, item.id, index)}
                        >
                          <Icon name="grip" size={16} />
                        </button>
                      )}
                    </span>
                    <span role="cell" className="name-cell">
                      {nameFields(item, 'd')}
                    </span>
                    {priceFields(item, 'cell')}
                    <span role="cell" className="c">
                      {switchEl(item, 'is_generic', `By Barber untuk ${item.name}`)}
                    </span>
                    <span role="cell" className="c">
                      {switchEl(item, 'is_active', `Aktifkan ${item.name}`)}
                    </span>
                    <span role="cell" className="r" style={{ whiteSpace: 'nowrap' }}>
                      {actionButtons(item)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="only-sm">
            {visible.map((item) => {
              const index = items.findIndex((row) => row.id === item.id);
              return (
                <article
                  key={item.id}
                  className="card barber-card"
                  style={{ opacity: item.is_active ? 1 : 0.6 }}
                  data-barber-id={item.id}
                >
                  <div className="barber-card-head">
                    <div className="name-cell">{nameFields(item, 'm')}</div>
                    <span className="muted" style={{ fontSize: 13 }} aria-hidden="true">
                      Aktif
                    </span>
                    {switchEl(item, 'is_active', `Aktif ${item.name}`)}
                  </div>
                  <div className="barber-card-prices">{priceFields(item, 'field')}</div>
                  <div className="barber-card-foot">
                    {switchEl(item, 'is_generic', `By Barber ${item.name}`)}
                    <span style={{ fontSize: 13, flex: 1 }}>By Barber</span>
                  </div>
                  <div className="barber-card-actions">
                    {canReorder && (
                      <>
                        <button
                          type="button"
                          className="btn-o icon-only"
                          aria-label={`Naikkan ${item.name}`}
                          disabled={index === 0}
                          onClick={() => move(item.id, index - 1)}
                        >
                          <Icon name="arrow-up" size={18} />
                        </button>
                        <button
                          type="button"
                          className="btn-o icon-only"
                          aria-label={`Turunkan ${item.name}`}
                          disabled={index === items.length - 1}
                          onClick={() => move(item.id, index + 1)}
                        >
                          <Icon name="arrow-down" size={18} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn-o icon-only"
                      aria-label={`Salin harga ke ${item.name} dari barber lain`}
                      disabled={items.length < 2}
                      onClick={() => setDialog({ kind: 'copy', id: item.id })}
                    >
                      <Icon name="copy" size={18} />
                    </button>
                    <button
                      type="button"
                      className="btn-o"
                      aria-label={`Pindah ${item.name} ke cabang lain`}
                      disabled={branches.length < 2}
                      onClick={() => setDialog({ kind: 'move', id: item.id })}
                    >
                      <Icon name="move" size={16} />
                      Pindah
                    </button>
                    <button
                      type="button"
                      className="btn-o btn-spam"
                      aria-label={`Hapus ${item.name}`}
                      onClick={() => setDialog({ kind: 'delete', id: item.id })}
                    >
                      <Icon name="trash" size={16} />
                      Hapus
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="page-note">
            Harga Coret opsional — kosongkan jika tidak ada promo. Di situs ditampilkan sebagai
            harga merah dicoret di atas harga utama.
          </p>
        </>
      )}

      <AddDialog
        open={dialog?.kind === 'add'}
        branchId={branchId}
        branchName={branch.name}
        onClose={() => setDialog(null)}
        onAdded={(row) => {
          setItems((current) => [...current, row]);
          setDialog(null);
          showToast({ kind: 'success', title: `${row.name} ditambahkan` });
        }}
      />

      <MoveDialog
        open={dialog?.kind === 'move' && target !== null}
        barber={target}
        branches={branches.filter((b) => b.id !== branchId)}
        onClose={() => setDialog(null)}
        onMoved={(row, to) => {
          setItems((current) => current.filter((item) => item.id !== row.id));
          setDialog(null);
          showToast({ kind: 'success', title: `${row.name} dipindah ke ${to.name}` });
        }}
      />

      <CopyDialog
        open={dialog?.kind === 'copy' && target !== null}
        barber={target}
        sources={items.filter((item) => item.id !== target?.id)}
        onClose={() => setDialog(null)}
        onCopy={async (source) => {
          if (!target) return;
          const message = await patch(
            target.id,
            {
              haircut_price: source.haircut_price,
              haircut_original_price: source.haircut_original_price,
              long_trim_price: source.long_trim_price,
              long_trim_original_price: source.long_trim_original_price,
            },
            `${target.id}:haircut_price`,
          );
          if (message) {
            showToast({ kind: 'error', title: 'Gagal menyalin harga', message });
            return;
          }
          for (const field of PRICE_FIELDS) flash(`${target.id}:${field.key}`);
          setDialog(null);
          showToast({ kind: 'success', title: `Harga ${target.name} disalin dari ${source.name}` });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete' && target !== null}
        title={`Hapus barber ${target?.name ?? ''}?`}
        description={`${target?.name ?? 'Barber ini'} akan dihapus dari pricelist ${branch.name} beserta harganya. Tindakan ini tidak dapat dibatalkan. Jika hanya cuti, nonaktifkan saja.`}
        confirmLabel="Hapus"
        secondary={
          target?.is_active
            ? {
                label: 'Nonaktifkan saja',
                onClick: () => {
                  const item = target;
                  setDialog(null);
                  void toggle(item, 'is_active');
                },
              }
            : undefined
        }
        busy={busy}
        onConfirm={() => target && void remove(target)}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------------------------

function AddDialog({
  open,
  branchId,
  branchName,
  onClose,
  onAdded,
}: {
  open: boolean;
  branchId: string;
  branchName: string;
  onClose: () => void;
  onAdded: (row: BarberItem) => void;
}) {
  const blank = { name: '', label: '', is_generic: false, haircut_price: '', long_trim_price: '' };
  const [values, setValues] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(blank);
      setErrors({});
    }
  }, [open]);

  const set = (key: keyof typeof blank, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  /** Isian harga di dialog memakai aturan sel yang sama ("130" = 130K). */
  const toPrice = (text: string) => {
    const parsed = parsePriceCell(text);
    return parsed === undefined ? text : parsed;
  };

  async function submit() {
    const payload = {
      branch_id: branchId,
      name: values.name,
      label: values.is_generic ? values.label : '',
      is_generic: values.is_generic,
      haircut_price: toPrice(values.haircut_price),
      long_trim_price: toPrice(values.long_trim_price),
    };
    const parsed = barberCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    const result = await callApi<BarberItem>('POST', '/api/admin/barbers', parsed.data);
    setBusy(false);
    if (!result.success) {
      setErrors({ ...result.error.details, _: result.error.message });
      return;
    }
    onAdded(result.data);
  }

  const field = (key: keyof typeof blank, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label className="fl" htmlFor={`add-${key}`}>
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
      icon="scissors"
      title="Tambah barber"
      description={`Barber baru masuk di akhir daftar ${branchName}. Harga coret bisa diatur dari tabel setelah disimpan.`}
      submitLabel="Simpan Barber"
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {field(
        'name',
        'Nama barber',
        <input
          id="add-name"
          className={`inp${errors.name ? ' err' : ''}`}
          maxLength={60}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
        />,
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={values.is_generic}
          onChange={(event) => set('is_generic', event.target.checked)}
        />
        <span>
          Tipe "By Barber"
          <span className="check-sub">
            Harga generik tanpa nama barber. Boleh lebih dari satu per cabang.
          </span>
        </span>
      </label>
      {values.is_generic &&
        field(
          'label',
          'Label (opsional)',
          <input
            id="add-label"
            className={`inp${errors.label ? ' err' : ''}`}
            maxLength={40}
            placeholder="mis. Tier 1"
            value={values.label}
            onChange={(event) => set('label', event.target.value)}
          />,
          'Membedakan beberapa "By Barber" di panel admin. Tidak tampil di situs.',
        )}
      <div className="two-col">
        {field(
          'haircut_price',
          'Haircut Reguler',
          <input
            id="add-haircut_price"
            className={`inp${errors.haircut_price ? ' err' : ''}`}
            inputMode="numeric"
            placeholder="130K"
            value={values.haircut_price}
            onChange={(event) => set('haircut_price', event.target.value)}
          />,
        )}
        {field(
          'long_trim_price',
          'Long Trim (opsional)',
          <input
            id="add-long_trim_price"
            className={`inp${errors.long_trim_price ? ' err' : ''}`}
            inputMode="numeric"
            placeholder="150K"
            value={values.long_trim_price}
            onChange={(event) => set('long_trim_price', event.target.value)}
          />,
        )}
      </div>
      {errors._ && (
        <p className="ferr" role="alert">
          {errors._}
        </p>
      )}
    </FormDialog>
  );
}

function MoveDialog({
  open,
  barber,
  branches,
  onClose,
  onMoved,
}: {
  open: boolean;
  barber: BarberItem | null;
  branches: BranchOption[];
  onClose: () => void;
  onMoved: (row: BarberItem, to: BranchOption) => void;
}) {
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTo('');
      setError('');
    }
  }, [open]);

  async function submit() {
    if (!barber) return;
    const destination = branches.find((b) => b.id === to);
    if (!destination) return;
    setBusy(true);
    const result = await callApi<BarberItem>('POST', `/api/admin/barbers/${barber.id}/move`, {
      branch_id: to,
    });
    setBusy(false);
    if (!result.success) {
      setError(firstMessage(result.error.details, result.error.message));
      return;
    }
    onMoved(barber, destination);
  }

  return (
    <FormDialog
      open={open}
      icon="move"
      title={`Pindahkan ${barber?.name ?? 'barber'} ke cabang lain`}
      description="Barber dan harganya pindah ke akhir daftar cabang tujuan."
      submitLabel="Pindahkan"
      busy={busy}
      canSubmit={to !== ''}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div>
        <label className="fl" htmlFor="move-to">
          Cabang tujuan
        </label>
        <select
          id="move-to"
          className="inp"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setError('');
          }}
        >
          <option value="">Pilih cabang…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {branchOptionLabel(b)}
            </option>
          ))}
        </select>
        {error && (
          <p className="ferr" role="alert">
            {error}
          </p>
        )}
      </div>
    </FormDialog>
  );
}

function CopyDialog({
  open,
  barber,
  sources,
  onClose,
  onCopy,
}: {
  open: boolean;
  barber: BarberItem | null;
  sources: BarberItem[];
  onClose: () => void;
  onCopy: (source: BarberItem) => Promise<void>;
}) {
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setFrom('');
  }, [open]);

  const source = sources.find((item) => item.id === from) ?? null;

  return (
    <FormDialog
      open={open}
      icon="copy"
      title={`Salin harga ke ${barber?.name ?? 'barber'}`}
      description="Haircut Reguler, Long Trim, dan harga coretnya diganti dengan harga barber yang dipilih."
      submitLabel="Salin Harga"
      busy={busy}
      canSubmit={source !== null}
      onSubmit={() => {
        if (!source) return;
        setBusy(true);
        void onCopy(source).finally(() => setBusy(false));
      }}
      onCancel={onClose}
    >
      <div>
        <label className="fl" htmlFor="copy-from">
          Salin dari
        </label>
        <select
          id="copy-from"
          className="inp"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        >
          <option value="">Pilih barber…</option>
          {sources.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.label ? ` (${item.label})` : ''} — {priceSummary(item)}
            </option>
          ))}
        </select>
      </div>
    </FormDialog>
  );
}

export type { PriceKey };
