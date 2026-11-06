// Katalog Layanan (PRD F-18, mockup Admin-Layanan): CRUD layanan, tipe harga inline, tampil di situs,
// urut ulang per kategori. Tabel (desktop) dan kartu (mobile) dirender bersamaan, satu state.
import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormDialog from '@/components/admin/FormDialog';
import Icon from '@/components/ui/Icon';
import { parsePriceCell } from '@/lib/admin/barbers';
import { moveItem } from '@/lib/admin/branches';
import { callApi } from '@/lib/admin/client';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  EMPTY_SERVICE,
  PRICE_TYPE_LABEL,
  groupByCategory,
  servicePriceText,
  toServiceForm,
  type Category,
  type PriceType,
  type ServiceFormValues,
  type ServiceItem,
} from '@/lib/admin/services';
import { showToast } from '@/lib/admin/toast';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { PRICE_TYPES, serviceCreateSchema } from '@/lib/validation/admin-services';

interface Props {
  items: ServiceItem[];
  /** Buka dialog Tambah Layanan saat halaman dimuat (?baru=1). */
  openAdd: boolean;
}

type Dialog =
  | { kind: 'form'; id: string | null; preset?: Partial<ServiceFormValues> }
  | { kind: 'delete'; id: string }
  | null;

const firstMessage = (details: Record<string, string>, fallback: string) =>
  Object.values(details)[0] ?? fallback;

export default function ServiceCatalog({ items: initial, openAdd }: Props) {
  const hydrated = useHydrated();
  const [items, setItems] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(openAdd ? { kind: 'form', id: null } : null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(() => setItems(initial), [initial]);

  const groups = groupByCategory(items);
  const target =
    dialog && dialog.kind === 'delete' ? (items.find((i) => i.id === dialog.id) ?? null) : null;
  const editing =
    dialog && dialog.kind === 'form' && dialog.id
      ? (items.find((i) => i.id === dialog.id) ?? null)
      : null;

  /** PATCH sebagian field. Mengembalikan pesan galat atau null. */
  async function patch(id: string, body: Record<string, unknown>): Promise<string | null> {
    const result = await callApi<ServiceItem>('PATCH', `/api/admin/services/${id}`, body);
    if (!result.success) return firstMessage(result.error.details, result.error.message);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...result.data } : item)),
    );
    return null;
  }

  async function toggleActive(item: ServiceItem) {
    const message = await patch(item.id, { is_active: !item.is_active });
    if (message) showToast({ kind: 'error', title: 'Gagal menyimpan', message });
    else
      showToast({
        kind: 'success',
        title: item.is_active
          ? `${item.name} disembunyikan dari situs`
          : `${item.name} tampil di situs`,
      });
  }

  async function changeType(item: ServiceItem, type: PriceType) {
    if (type === item.price_type) return;
    // Rentang butuh harga maksimum: minta lewat form, jangan menebak.
    if (type === 'range' && item.price_max === null) {
      setDialog({ kind: 'form', id: item.id, preset: { price_type: 'range' } });
      return;
    }
    const message = await patch(item.id, { price_type: type });
    if (message) showToast({ kind: 'error', title: 'Gagal mengubah tipe harga', message });
    else showToast({ kind: 'success', title: 'Tipe harga diperbarui' });
  }

  async function persistOrder(category: Category, next: ServiceItem[], message: string) {
    const previous = items;
    setItems((current) => [
      ...current.filter((item) => item.category !== category),
      ...next.map((item, index) => ({ ...item, sort_order: index + 1 })),
    ]);
    const result = await callApi(
      'PATCH',
      '/api/admin/services/reorder',
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

  function move(category: Category, id: string, to: number) {
    const group = groups.find((g) => g.category === category)!.items;
    const from = group.findIndex((item) => item.id === id);
    if (from === -1 || to < 0 || to >= group.length || from === to) return;
    void persistOrder(
      category,
      moveItem(group, from, to),
      `${group[from]!.name} dipindah ke urutan ${to + 1} dari ${group.length} di ${CATEGORY_LABEL[category]}.`,
    );
  }

  function onHandleKey(event: React.KeyboardEvent, category: Category, id: string, index: number) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(category, id, index - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(category, id, index + 1);
    }
  }

  async function remove(item: ServiceItem) {
    setBusy(true);
    const result = await callApi('DELETE', `/api/admin/services/${item.id}`);
    setBusy(false);
    setDialog(null);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    showToast({ kind: 'success', title: `${item.name} dihapus` });
  }

  const typeSelect = (item: ServiceItem, prefix: string) => (
    <>
      <label className="sr-only" htmlFor={`${prefix}-${item.id}-type`}>
        Tipe harga {item.name}
      </label>
      <select
        id={`${prefix}-${item.id}-type`}
        className="sel"
        value={item.price_type}
        onChange={(event) => void changeType(item, event.target.value as PriceType)}
      >
        {PRICE_TYPES.map((type) => (
          <option key={type} value={type}>
            {PRICE_TYPE_LABEL[type]}
          </option>
        ))}
      </select>
    </>
  );

  const activeSwitch = (item: ServiceItem) => (
    <button
      type="button"
      className={`sw${item.is_active ? ' on' : ''}`}
      role="switch"
      aria-checked={item.is_active}
      aria-label={`Tampilkan ${item.name} di situs`}
      onClick={() => void toggleActive(item)}
    />
  );

  const nameBlock = (item: ServiceItem) => (
    <span className="name-cell">
      <strong>{item.name}</strong>
      {item.note && <span className="muted note">{item.note}</span>}
    </span>
  );

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" data-hydrated={String(hydrated)}>
        {announce}
      </p>

      {items.length === 0 ? (
        <div className="card empty-state">
          <span aria-hidden="true" className="empty-icon">
            <Icon name="lines" size={26} />
          </span>
          <p className="h3">Belum ada layanan</p>
          <p className="muted" style={{ margin: 0, maxWidth: 380, lineHeight: 1.55, fontSize: 14 }}>
            Tambahkan layanan pertama. Layanan baru otomatis dibuatkan status "Tidak Tersedia" di
            semua cabang.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setDialog({ kind: 'form', id: null })}
          >
            Tambah Layanan
          </button>
        </div>
      ) : (
        <>
          <div className="card only-lg" style={{ overflow: 'hidden' }}>
            <div role="table" aria-label="Katalog layanan">
              <div role="row" className="thr service-grid">
                <span role="columnheader">
                  <span className="sr-only">Urutan</span>
                </span>
                <span role="columnheader">Layanan</span>
                <span role="columnheader">Kategori</span>
                <span role="columnheader">Tipe harga</span>
                <span role="columnheader" className="r">
                  Harga
                </span>
                <span role="columnheader" className="c">
                  Tampil
                </span>
                <span role="columnheader" className="r">
                  Aksi
                </span>
              </div>
              {groups.map((group) => (
                <div key={group.category} role="rowgroup">
                  <div role="row" className="grp-row">
                    <span role="cell">{group.title}</span>
                    <span className="grp-count">{group.items.length} layanan</span>
                  </div>
                  {group.items.map((item, index) => (
                    <div
                      key={item.id}
                      role="row"
                      className={[
                        'tr',
                        'service-grid',
                        item.is_active ? '' : 'off',
                        dragId === item.id ? 'dragging' : '',
                        overId === item.id && dragId !== item.id ? 'drop-target' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      data-service-id={item.id}
                      draggable
                      onDragStart={(event) => {
                        setDragId(item.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', item.id);
                      }}
                      onDragOver={(event) => {
                        const dragged = items.find((i) => i.id === dragId);
                        if (!dragged || dragged.category !== item.category) return;
                        event.preventDefault();
                        setOverId(item.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const dragged = items.find((i) => i.id === dragId);
                        if (
                          dragged &&
                          dragged.id !== item.id &&
                          dragged.category === item.category
                        ) {
                          move(item.category, dragged.id, index);
                        }
                        setDragId(null);
                        setOverId(null);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverId(null);
                      }}
                    >
                      <span role="cell">
                        <button
                          type="button"
                          className="ib grip"
                          aria-label={`Atur urutan ${item.name}, urutan ${index + 1} dari ${group.items.length}. Seret, atau tekan panah atas/bawah.`}
                          onKeyDown={(event) => onHandleKey(event, item.category, item.id, index)}
                        >
                          <Icon name="grip" size={16} />
                        </button>
                      </span>
                      <span role="cell">{nameBlock(item)}</span>
                      <span role="cell" className="muted">
                        {CATEGORY_LABEL[item.category]}
                      </span>
                      <span role="cell">{typeSelect(item, 'd')}</span>
                      <span role="cell" className="r" style={{ fontWeight: 700 }}>
                        {servicePriceText(item)}
                      </span>
                      <span role="cell" className="c">
                        {activeSwitch(item)}
                      </span>
                      <span role="cell" className="r" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="ib"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => setDialog({ kind: 'form', id: item.id })}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          type="button"
                          className="ib dng"
                          aria-label={`Hapus ${item.name}`}
                          onClick={() => setDialog({ kind: 'delete', id: item.id })}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="only-sm">
            {groups.map((group) => (
              <section key={group.category} aria-label={group.title} className="svc-group">
                <h2 className="svc-group-title">
                  {group.title} <span>{group.items.length} layanan</span>
                </h2>
                {group.items.map((item, index) => (
                  <article
                    key={item.id}
                    className="card barber-card"
                    style={{ opacity: item.is_active ? 1 : 0.6 }}
                    data-service-id={item.id}
                  >
                    <div className="barber-card-head">
                      <div className="name-cell">{nameBlock(item)}</div>
                      <strong style={{ fontSize: 15 }}>{servicePriceText(item)}</strong>
                    </div>
                    <div className="svc-card-row">
                      <div style={{ flex: 1 }}>{typeSelect(item, 'm')}</div>
                      <span className="muted" style={{ fontSize: 13 }} aria-hidden="true">
                        Tampil
                      </span>
                      {activeSwitch(item)}
                    </div>
                    <div className="svc-card-actions">
                      <button
                        type="button"
                        className="btn-o icon-only"
                        aria-label={`Naikkan ${item.name}`}
                        disabled={index === 0}
                        onClick={() => move(item.category, item.id, index - 1)}
                      >
                        <Icon name="arrow-up" size={18} />
                      </button>
                      <button
                        type="button"
                        className="btn-o icon-only"
                        aria-label={`Turunkan ${item.name}`}
                        disabled={index === group.items.length - 1}
                        onClick={() => move(item.category, item.id, index + 1)}
                      >
                        <Icon name="arrow-down" size={18} />
                      </button>
                      <button
                        type="button"
                        className="btn-o"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => setDialog({ kind: 'form', id: item.id })}
                      >
                        <Icon name="edit" size={16} />
                        Edit
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
                ))}
              </section>
            ))}
          </div>

          <p className="page-note">
            <strong style={{ color: 'var(--a-ink)' }}>Tetap</strong> = satu harga (20K) ·{' '}
            <strong style={{ color: 'var(--a-ink)' }}>Mulai dari</strong> = ditampilkan "Mulai 350K"
            · <strong style={{ color: 'var(--a-ink)' }}>Rentang</strong> = harga minimum–maksimum
            (150K–300K).
          </p>
        </>
      )}

      <ServiceDialog
        open={dialog?.kind === 'form'}
        service={editing}
        preset={dialog?.kind === 'form' ? dialog.preset : undefined}
        onClose={() => setDialog(null)}
        onSaved={(row, created) => {
          setItems((current) =>
            created
              ? [...current, row]
              : current.map((item) => (item.id === row.id ? { ...item, ...row } : item)),
          );
          setDialog(null);
          showToast({
            kind: 'success',
            title: created ? `${row.name} ditambahkan` : 'Perubahan tersimpan',
            message: created
              ? 'Status awal "Tidak Tersedia" di semua cabang. Atur di tab Ketersediaan.'
              : undefined,
          });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete' && target !== null}
        title={`Hapus layanan ${target?.name ?? ''}?`}
        description={`${target?.name ?? 'Layanan ini'} dihapus dari katalog beserta status ketersediaannya di semua cabang. Tindakan ini tidak dapat dibatalkan. Jika hanya tidak ditawarkan sementara, sembunyikan saja.`}
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
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function ServiceDialog({
  open,
  service,
  preset,
  onClose,
  onSaved,
}: {
  open: boolean;
  service: ServiceItem | null;
  preset?: Partial<ServiceFormValues>;
  onClose: () => void;
  onSaved: (row: ServiceItem, created: boolean) => void;
}) {
  const initial = { ...(service ? toServiceForm(service) : EMPTY_SERVICE), ...preset };
  const [values, setValues] = useState<ServiceFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({ ...(service ? toServiceForm(service) : EMPTY_SERVICE), ...preset });
      setErrors({});
    }
    // Hanya saat dialog dibuka: service/preset berubah di tengah pengetikan tidak boleh menimpa isian.
  }, [open]);

  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  /** Isian harga memakai aturan sel yang sama ("350" = 350K, "62,5K", "150.000"). */
  const toPrice = (text: string) => {
    const parsed = parsePriceCell(text);
    return parsed === undefined ? text : parsed;
  };

  async function submit() {
    const payload = {
      ...values,
      price_min: toPrice(values.price_min),
      price_max: values.price_type === 'range' ? toPrice(values.price_max) : null,
    };
    const parsed = serviceCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    const result = service
      ? await callApi<ServiceItem>('PUT', `/api/admin/services/${service.id}`, parsed.data)
      : await callApi<ServiceItem>('POST', '/api/admin/services', parsed.data);
    setBusy(false);
    if (!result.success) {
      setErrors({ ...result.error.details, _: result.error.message });
      return;
    }
    onSaved(result.data, !service);
  }

  const minLabel =
    values.price_type === 'range'
      ? 'Harga minimum'
      : values.price_type === 'start_from'
        ? 'Harga mulai dari'
        : 'Harga';

  const field = (key: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label className="fl" htmlFor={`svc-${key}`}>
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
      icon="lines"
      title={service ? `Edit ${service.name}` : 'Tambah layanan'}
      description={
        service
          ? undefined
          : 'Layanan baru otomatis dibuatkan status "Tidak Tersedia" di semua cabang. Atur di tab Ketersediaan per Cabang.'
      }
      submitLabel={service ? 'Simpan Perubahan' : 'Simpan Layanan'}
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      {field(
        'name',
        'Nama layanan',
        <input
          id="svc-name"
          className={`inp${errors.name ? ' err' : ''}`}
          maxLength={80}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
        />,
      )}
      <div className="two-col">
        {field(
          'category',
          'Kategori',
          <select
            id="svc-category"
            className="inp"
            value={values.category}
            onChange={(event) => set('category', event.target.value as Category)}
          >
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>,
        )}
        {field(
          'price_type',
          'Tipe harga',
          <select
            id="svc-price_type"
            className="inp"
            value={values.price_type}
            onChange={(event) => set('price_type', event.target.value as PriceType)}
          >
            {PRICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PRICE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>,
        )}
      </div>
      <div className="two-col">
        {field(
          'price_min',
          minLabel,
          <input
            id="svc-price_min"
            className={`inp${errors.price_min ? ' err' : ''}`}
            inputMode="numeric"
            placeholder="350K"
            value={values.price_min}
            onChange={(event) => set('price_min', event.target.value)}
          />,
        )}
        {values.price_type === 'range' &&
          field(
            'price_max',
            'Harga maksimum',
            <input
              id="svc-price_max"
              className={`inp${errors.price_max ? ' err' : ''}`}
              inputMode="numeric"
              placeholder="300K"
              value={values.price_max}
              onChange={(event) => set('price_max', event.target.value)}
            />,
          )}
      </div>
      {field(
        'note',
        'Catatan (opsional)',
        <input
          id="svc-note"
          className={`inp${errors.note ? ' err' : ''}`}
          maxLength={80}
          placeholder="mis. Dark Brown"
          value={values.note}
          onChange={(event) => set('note', event.target.value)}
        />,
        'Tampil di samping nama layanan di situs.',
      )}
      {field(
        'description',
        'Deskripsi (opsional)',
        <textarea
          id="svc-description"
          className={`inp${errors.description ? ' err' : ''}`}
          maxLength={500}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
        />,
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(event) => set('is_active', event.target.checked)}
        />
        <span>
          Tampil di situs
          <span className="check-sub">
            Layanan yang disembunyikan tidak muncul di halaman mana pun.
          </span>
        </span>
      </label>
      {errors._ && (
        <p className="ferr" role="alert">
          {errors._}
        </p>
      )}
    </FormDialog>
  );
}
