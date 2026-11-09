// Panel detail lead (PRD F-19): ubah status, catatan admin, Chat WA, hapus (Super Admin).
import { useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import Icon from '@/components/ui/Icon';
import { STATUS_BADGE, STATUS_LABEL, STATUS_ORDER, type LeadStatus } from '@/lib/admin/leads';
import { showToast } from '@/lib/admin/toast';

interface Field {
  label: string;
  value: string;
}

export interface LeadDetailData {
  id: string;
  typeLabel: string;
  name: string;
  status: LeadStatus;
  note: string;
  dateLabel: string;
  sourcePath: string | null;
  waUrl: string;
  fields: Field[];
}

interface Props {
  lead: LeadDetailData;
  canDelete: boolean;
  /** Tujuan setelah lead dihapus (daftar dengan filter yang sama). */
  listHref: string;
}

type ApiResult = { success: true; data: unknown } | { success: false; error: { message: string } };

async function api(method: 'PATCH' | 'DELETE', id: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(`/api/admin/leads/${id}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await response.json()) as ApiResult;
}

/** Perbarui badge status di daftar (server-rendered) tanpa memuat ulang halaman. */
function syncListBadge(id: string, status: LeadStatus) {
  for (const badge of document.querySelectorAll<HTMLElement>(
    `[data-lead-id="${id}"] [data-lead-badge]`,
  )) {
    badge.className = `bd ${STATUS_BADGE[status]}`;
    badge.textContent = STATUS_LABEL[status];
  }
}

export default function LeadDetail({ lead, canDelete, listHref }: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [note, setNote] = useState(lead.note);
  const [savedNote, setSavedNote] = useState(lead.note);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(patch: { status?: LeadStatus; admin_note?: string }, message: string) {
    setBusy(true);
    try {
      const result = await api('PATCH', lead.id, patch);
      if (!result.success) {
        showToast({ kind: 'error', title: 'Gagal menyimpan', message: result.error.message });
        return false;
      }
      if (patch.status) {
        setStatus(patch.status);
        syncListBadge(lead.id, patch.status);
      }
      if (patch.admin_note !== undefined) setSavedNote(patch.admin_note);
      showToast({ kind: 'success', title: message });
      return true;
    } catch {
      showToast({
        kind: 'error',
        title: 'Gagal menyimpan',
        message: 'Koneksi bermasalah. Coba lagi.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const result = await api('DELETE', lead.id);
      if (result.success) {
        window.location.assign(listHref);
        return;
      }
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
    } catch {
      showToast({
        kind: 'error',
        title: 'Gagal menghapus',
        message: 'Koneksi bermasalah. Coba lagi.',
      });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const noteChanged = note !== savedNote;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid #E0E0E0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            className="lbl"
            style={{
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            Lead {lead.typeLabel}
            <span className={`bd ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
          </p>
          <h2 id="lead-detail-h" className="h3" style={{ fontSize: 20, overflowWrap: 'anywhere' }}>
            {lead.name}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5B6161' }}>
            Masuk {lead.dateLabel}
            {lead.sourcePath ? ` · dari halaman ${lead.sourcePath}` : ''}
          </p>
        </div>
        <a className="btn" href={lead.waUrl} target="_blank" rel="noopener">
          <Icon name="whatsapp" size={18} />
          Chat WA
        </a>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="fl" htmlFor="lead-status">
            Status
          </label>
          <select
            id="lead-status"
            className="inp"
            value={status}
            disabled={busy}
            onChange={(event) => {
              void save({ status: event.target.value as LeadStatus }, 'Status diperbarui');
            }}
          >
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="lbl" style={{ marginBottom: 4 }}>
            Isian form
          </p>
          <dl style={{ margin: 0 }}>
            {lead.fields.map((field) => (
              <div className="fld" key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <label className="fl" htmlFor="lead-note">
            Catatan admin
          </label>
          <textarea
            id="lead-note"
            className="inp"
            maxLength={2000}
            placeholder="mis. Sudah ditelepon, minta info jadwal kelas Desember."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#5B6161' }}>
            Hanya terlihat oleh admin.
          </p>
        </div>

        {canDelete && (
          <button
            type="button"
            className="btn-o btn-spam"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Icon name="trash" size={18} />
            Hapus permanen
          </button>
        )}

        <div className="lead-actions-bar">
          <div className="lead-actions">
            <button
              type="button"
              className="btn-o btn-spam"
              disabled={busy || status === 'spam'}
              onClick={() => void save({ status: 'spam' }, 'Ditandai sebagai spam')}
            >
              Tandai Spam
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !noteChanged}
              onClick={() => void save({ admin_note: note }, 'Catatan tersimpan')}
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Hapus lead ${lead.name}?`}
        description="Lead dihapus permanen beserta catatannya. Tindakan ini tidak dapat dibatalkan. Jika hanya spam, tandai sebagai spam saja."
        confirmLabel="Hapus"
        secondary={{
          label: 'Tandai spam saja',
          onClick: () => {
            setConfirmDelete(false);
            void save({ status: 'spam' }, 'Ditandai sebagai spam');
          },
        }}
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
