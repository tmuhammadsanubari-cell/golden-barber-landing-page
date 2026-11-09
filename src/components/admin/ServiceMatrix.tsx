// Ketersediaan per Cabang (PRD F-18, mockup Admin-Layanan-Matriks): baris = layanan, kolom = cabang,
// sel = status + harga khusus opsional. Kolom layanan menempel (sticky) saat digeser di mobile.
// Simpan otomatis per sel lewat bulk upsert per cabang; "Terapkan ke semua cabang" per baris.
import { useEffect, useMemo, useState } from 'react';
import FormDialog from '@/components/admin/FormDialog';
import Icon from '@/components/ui/Icon';
import { parsePriceCell } from '@/lib/admin/barbers';
import { REGION_LABEL, type Region } from '@/lib/admin/branches';
import { callApi } from '@/lib/admin/client';
import {
  DEFAULT_STATUS,
  STATUS_CLASS,
  STATUS_LABEL,
  groupByCategory,
  overrideText,
  type ServiceItem,
  type Status,
} from '@/lib/admin/services';
import { showToast } from '@/lib/admin/toast';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { STATUSES, checkOverride } from '@/lib/validation/admin-services';
import { optionalPrice } from '@/lib/validation/admin-barbers';

export interface MatrixBranch {
  id: string;
  name: string;
  region: Region;
  is_active: boolean;
}

export interface MatrixCell {
  branch_id: string;
  service_id: string;
  status: Status;
  price_override_min: number | null;
  price_override_max: number | null;
}

interface Props {
  branches: MatrixBranch[];
  services: ServiceItem[];
  cells: MatrixCell[];
}

type Dialog =
  | { kind: 'override'; branchId: string; serviceId: string }
  | { kind: 'all'; serviceId: string }
  | null;

const key = (branchId: string, serviceId: string) => `${branchId}:${serviceId}`;

const firstMessage = (details: Record<string, string>, fallback: string) =>
  Object.values(details)[0] ?? fallback;

export default function ServiceMatrix({ branches, services, cells: initial }: Props) {
  const hydrated = useHydrated();
  const [cells, setCells] = useState(
    () => new Map(initial.map((cell) => [key(cell.branch_id, cell.service_id), cell])),
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(
    () => setCells(new Map(initial.map((cell) => [key(cell.branch_id, cell.service_id), cell]))),
    [initial],
  );

  const groups = useMemo(() => groupByCategory(services), [services]);
  const cellOf = (branchId: string, serviceId: string): MatrixCell =>
    cells.get(key(branchId, serviceId)) ?? {
      branch_id: branchId,
      service_id: serviceId,
      status: DEFAULT_STATUS,
      price_override_min: null,
      price_override_max: null,
    };

  /** Simpan satu sel (bulk upsert satu item); kembalikan pesan galat atau null. Optimistis, dipulihkan bila gagal. */
  async function save(next: MatrixCell): Promise<string | null> {
    const k = key(next.branch_id, next.service_id);
    const previous = cells.get(k);
    setCells((current) => new Map(current).set(k, next));
    const result = await callApi('PUT', `/api/admin/branches/${next.branch_id}/services`, [
      {
        service_id: next.service_id,
        status: next.status,
        price_override_min: next.price_override_min,
        price_override_max: next.price_override_max,
      },
    ]);
    if (!result.success) {
      setCells((current) => {
        const restored = new Map(current);
        if (previous) restored.set(k, previous);
        else restored.delete(k);
        return restored;
      });
      return firstMessage(result.error.details, result.error.message);
    }
    setFlash(k);
    setTimeout(() => setFlash((current) => (current === k ? null : current)), 1500);
    return null;
  }

  async function changeStatus(branch: MatrixBranch, service: ServiceItem, status: Status) {
    const message = await save({ ...cellOf(branch.id, service.id), status });
    if (message) {
      showToast({ kind: 'error', title: 'Gagal menyimpan', message });
      return;
    }
    setAnnounce(`${service.name} di ${branch.name}: ${STATUS_LABEL[status]}. Tersimpan.`);
  }

  const dialogService =
    dialog && services.find((service) => service.id === dialog.serviceId)
      ? services.find((s) => s.id === dialog.serviceId)!
      : null;
  const dialogBranch =
    dialog?.kind === 'override' ? (branches.find((b) => b.id === dialog.branchId) ?? null) : null;

  if (services.length === 0 || branches.length === 0) {
    return (
      <div className="card empty-state">
        <span aria-hidden="true" className="empty-icon">
          <Icon name="lines" size={26} />
        </span>
        <p className="h3">{services.length === 0 ? 'Belum ada layanan' : 'Belum ada cabang'}</p>
        <p className="muted" style={{ margin: 0, maxWidth: 380, lineHeight: 1.55, fontSize: 14 }}>
          Matriks muncul setelah ada minimal satu layanan dan satu cabang.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="legend" data-hydrated={String(hydrated)}>
        <span className="dot dot-ok">Tersedia</span>
        <span className="dot dot-soon">Segera Hadir</span>
        <span className="dot dot-no">Tidak Tersedia</span>
        <span className="muted" style={{ fontSize: 13 }}>
          Tidak Tersedia = disembunyikan di halaman cabang.
        </span>
        <span className="legend-scroll muted">
          Geser ke samping untuk {branches.length} cabang
          <Icon name="chevron-right" size={16} />
        </span>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <div
        className="card matrix-scroll"
        role="region"
        aria-label="Matriks ketersediaan layanan, dapat digeser horizontal"
        tabIndex={0}
      >
        <div
          role="table"
          aria-label="Ketersediaan layanan per cabang"
          className="mx-table"
          style={{ ['--mx-n' as string]: branches.length }}
        >
          <div role="row" className="mx mh">
            <span role="columnheader" className="stk">
              <span className="lbl">Layanan</span>
            </span>
            {branches.map((branch) => (
              <span role="columnheader" key={branch.id}>
                <strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                  {branch.name}
                  {!branch.is_active && <span className="muted"> (nonaktif)</span>}
                </strong>
                <span className="muted" style={{ fontSize: 11 }}>
                  {REGION_LABEL[branch.region]}
                </span>
              </span>
            ))}
          </div>
          {groups.map((group) => (
            <div key={group.category} role="rowgroup">
              <div role="row" className="gr">
                <span role="cell">{group.title}</span>
              </div>
              {group.items.map((service) => (
                <div role="row" className="mx" key={service.id} data-service-id={service.id}>
                  <span role="rowheader" className="stk stk-row">
                    <span className="stk-name">
                      {service.name}
                      {!service.is_active && <span className="muted note"> (disembunyikan)</span>}
                    </span>
                    <button
                      type="button"
                      className="ib"
                      title="Terapkan status ke semua cabang"
                      aria-label={`Terapkan status ${service.name} ke semua cabang`}
                      onClick={() => setDialog({ kind: 'all', serviceId: service.id })}
                    >
                      <Icon name="layers" size={18} />
                    </button>
                  </span>
                  {branches.map((branch) => {
                    const cell = cellOf(branch.id, service.id);
                    const override = overrideText(cell.price_override_min, cell.price_override_max);
                    const id = `av-${branch.id}-${service.id}`;
                    return (
                      <span
                        role="cell"
                        key={branch.id}
                        className={`mx-cell${flash === key(branch.id, service.id) ? ' flash' : ''}`}
                        data-branch-id={branch.id}
                      >
                        <span className="mx-cell-main">
                          <select
                            id={id}
                            className={`av ${STATUS_CLASS[cell.status]}`}
                            value={cell.status}
                            aria-label={`${service.name} di ${branch.name}`}
                            onChange={(event) =>
                              void changeStatus(branch, service, event.target.value as Status)
                            }
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={`ib mx-price${override ? ' has' : ''}`}
                            title={override ? `Harga khusus ${override}` : 'Atur harga khusus'}
                            aria-label={
                              override
                                ? `Harga khusus ${service.name} di ${branch.name}: ${override}. Ubah.`
                                : `Atur harga khusus ${service.name} di ${branch.name}`
                            }
                            onClick={() =>
                              setDialog({
                                kind: 'override',
                                branchId: branch.id,
                                serviceId: service.id,
                              })
                            }
                          >
                            <Icon name="tag" size={16} />
                          </button>
                        </span>
                        {override && <span className="mx-override">{override}</span>}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="page-note">
        Tips: tekan Tab untuk berpindah sel, lalu panah atas/bawah untuk mengganti status. Ikon
        label di samping status mengatur harga khusus cabang itu.
      </p>

      <OverrideDialog
        open={dialog?.kind === 'override' && dialogService !== null && dialogBranch !== null}
        service={dialogService}
        branch={dialogBranch}
        cell={dialog?.kind === 'override' ? cellOf(dialog.branchId, dialog.serviceId) : null}
        onClose={() => setDialog(null)}
        onSave={async (min, max) => {
          if (dialog?.kind !== 'override') return null;
          const message = await save({
            ...cellOf(dialog.branchId, dialog.serviceId),
            price_override_min: min,
            price_override_max: max,
          });
          if (message === null) {
            setDialog(null);
            showToast({
              kind: 'success',
              title: min === null ? 'Harga khusus dihapus' : 'Harga khusus tersimpan',
            });
          }
          return message;
        }}
      />

      <ApplyAllDialog
        open={dialog?.kind === 'all' && dialogService !== null}
        service={dialogService}
        branchCount={branches.length}
        onClose={() => setDialog(null)}
        onApplied={(status) => {
          if (!dialogService) return;
          setCells((current) => {
            const next = new Map(current);
            for (const branch of branches) {
              const k = key(branch.id, dialogService.id);
              next.set(k, { ...cellOf(branch.id, dialogService.id), status });
            }
            return next;
          });
          setDialog(null);
          showToast({
            kind: 'success',
            title: `${dialogService.name}: ${STATUS_LABEL[status]} di semua cabang`,
          });
          setAnnounce(`${dialogService.name} diset ${STATUS_LABEL[status]} di semua cabang.`);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function OverrideDialog({
  open,
  service,
  branch,
  cell,
  onClose,
  onSave,
}: {
  open: boolean;
  service: ServiceItem | null;
  branch: MatrixBranch | null;
  cell: MatrixCell | null;
  onClose: () => void;
  onSave: (min: number | null, max: number | null) => Promise<string | null>;
}) {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && cell) {
      setMin(cell.price_override_min === null ? '' : String(cell.price_override_min));
      setMax(cell.price_override_max === null ? '' : String(cell.price_override_max));
      setErrors({});
    }
    // Hanya saat dialog dibuka: perubahan sel di latar tidak boleh menimpa isian.
  }, [open]);

  /** Parse tiap isian dengan aturan harga yang sama ("85" = 85K); kosong → null. */
  function parse(text: string): { value: number | null; error?: string } {
    const cellValue = parsePriceCell(text);
    const result = optionalPrice.safeParse(cellValue === undefined ? text : cellValue);
    if (!result.success)
      return { value: null, error: result.error.issues[0]?.message ?? 'Harga tidak valid.' };
    return { value: result.data };
  }

  async function submit(clear = false) {
    if (clear) {
      setBusy(true);
      const message = await onSave(null, null);
      setBusy(false);
      if (message) setErrors({ _: message });
      return;
    }
    const a = parse(min);
    const b = parse(max);
    const next: Record<string, string> = {};
    if (a.error) next.price_override_min = a.error;
    if (b.error) next.price_override_max = b.error;
    if (!a.error && !b.error) Object.assign(next, checkOverride(a.value, b.value));
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setBusy(true);
    const message = await onSave(a.value, b.value);
    setBusy(false);
    if (message) setErrors({ _: message });
  }

  const hasOverride = cell !== null && cell.price_override_min !== null;
  const base = service
    ? `Harga katalog: ${overrideText(service.price_min, service.price_type === 'range' ? service.price_max : null)}.`
    : '';

  return (
    <FormDialog
      open={open}
      icon="tag"
      title={`Harga khusus ${service?.name ?? ''}`}
      description={`Berlaku hanya di cabang ${branch?.name ?? ''} dan menggantikan harga katalog di halaman cabang itu. ${base} Kosongkan keduanya untuk memakai harga katalog.`}
      submitLabel="Simpan Harga"
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="two-col">
        <div>
          <label className="fl" htmlFor="ov-min">
            Harga khusus
          </label>
          <input
            id="ov-min"
            className={`inp${errors.price_override_min ? ' err' : ''}`}
            inputMode="numeric"
            placeholder="85K"
            value={min}
            onChange={(event) => {
              setMin(event.target.value);
              setErrors({});
            }}
          />
          {errors.price_override_min && (
            <p className="ferr" role="alert">
              {errors.price_override_min}
            </p>
          )}
        </div>
        <div>
          <label className="fl" htmlFor="ov-max">
            Sampai (opsional)
          </label>
          <input
            id="ov-max"
            className={`inp${errors.price_override_max ? ' err' : ''}`}
            inputMode="numeric"
            placeholder="100K"
            value={max}
            onChange={(event) => {
              setMax(event.target.value);
              setErrors({});
            }}
          />
          {errors.price_override_max && (
            <p className="ferr" role="alert">
              {errors.price_override_max}
            </p>
          )}
        </div>
      </div>
      {errors._ && (
        <p className="ferr" role="alert">
          {errors._}
        </p>
      )}
      {hasOverride && (
        <button
          type="button"
          className="btn-o btn-spam"
          disabled={busy}
          onClick={() => void submit(true)}
        >
          Hapus harga khusus
        </button>
      )}
    </FormDialog>
  );
}

function ApplyAllDialog({
  open,
  service,
  branchCount,
  onClose,
  onApplied,
}: {
  open: boolean;
  service: ServiceItem | null;
  branchCount: number;
  onClose: () => void;
  onApplied: (status: Status) => void;
}) {
  const [status, setStatus] = useState<Status | ''>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus('');
      setError('');
    }
  }, [open]);

  async function submit() {
    if (!service || status === '') return;
    setBusy(true);
    const result = await callApi('PUT', `/api/admin/services/${service.id}/availability`, {
      status,
    });
    setBusy(false);
    if (!result.success) {
      setError(firstMessage(result.error.details, result.error.message));
      return;
    }
    onApplied(status);
  }

  return (
    <FormDialog
      open={open}
      icon="layers"
      title={`Terapkan ${service?.name ?? 'layanan'} ke semua cabang`}
      description={`Status layanan ini di semua ${branchCount} cabang diganti sama. Harga khusus per cabang tidak berubah.`}
      submitLabel="Terapkan"
      busy={busy}
      canSubmit={status !== ''}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div>
        <label className="fl" htmlFor="all-status">
          Status untuk semua cabang
        </label>
        <select
          id="all-status"
          className="inp"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as Status | '');
            setError('');
          }}
        >
          <option value="">Pilih status…</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
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
