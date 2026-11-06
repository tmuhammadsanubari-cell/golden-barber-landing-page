// Tabel cabang (PRD F-16, mockup Admin-Cabang): urut ulang (seret ⋮⋮, atau tombol naik/turun
// dan panah di keyboard), menu baris (aktif/nonaktif, hapus). Edit membuka panel lewat ?id=.
import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import Icon from '@/components/ui/Icon';
import {
  REGION_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  branchStatus,
  moveItem,
  type BranchListItem,
} from '@/lib/admin/branches';
import { callApi } from '@/lib/admin/client';
import { showToast } from '@/lib/admin/toast';
import { useHydrated } from '@/lib/admin/use-hydrated';

interface Props {
  items: BranchListItem[];
  selectedId: string | null;
  /** Urutan hanya bisa diubah pada daftar penuh (tanpa filter/pencarian). */
  canReorder: boolean;
  /** href tombol Edit per id (mempertahankan filter). */
  editHrefs: Record<string, string>;
  /** Tujuan setelah cabang yang sedang dibuka dihapus. */
  listHref: string;
}

export default function BranchTable({
  items: initial,
  selectedId,
  canReorder,
  editHrefs,
  listHref,
}: Props) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [toDelete, setToDelete] = useState<BranchListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => setItems(initial), [initial]);

  // Tutup menu baris: klik di luar atau Esc.
  useEffect(() => {
    if (!menuId) return;
    // Tabel desktop dan kartu mobile sama-sama dirender (salah satunya tersembunyi), jadi
    // cek lewat atribut, bukan ref.
    const onDown = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[data-rowmenu]')) setMenuId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuId]);

  async function persist(next: BranchListItem[], previous: BranchListItem[], message: string) {
    setItems(next);
    const result = await callApi(
      'PATCH',
      '/api/admin/branches/reorder',
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
    const name = items[from]!.name;
    void persist(
      moveItem(items, from, to),
      items,
      `${name} dipindah ke urutan ${to + 1} dari ${items.length}.`,
    );
  }

  async function toggleActive(item: BranchListItem) {
    setMenuId(null);
    const result = await callApi('PATCH', `/api/admin/branches/${item.id}`, {
      is_active: !item.is_active,
    });
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal mengubah status', message: result.error.message });
      return;
    }
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_active: !item.is_active } : row)),
    );
    showToast({
      kind: 'success',
      title: item.is_active ? `${item.name} dinonaktifkan` : `${item.name} diaktifkan`,
    });
  }

  async function remove(item: BranchListItem) {
    setBusy(true);
    const result = await callApi('DELETE', `/api/admin/branches/${item.id}`);
    setBusy(false);
    setToDelete(null);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
      return;
    }
    showToast({ kind: 'success', title: `${item.name} dihapus` });
    // Muat ulang agar hitungan chip ikut benar; bila panel cabang ini terbuka, tutup.
    window.location.assign(item.id === selectedId ? listHref : window.location.href);
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

  const rowMenu = (item: BranchListItem) => (
    <div style={{ position: 'relative', display: 'inline-block' }} data-rowmenu>
      <button
        type="button"
        className="ib"
        aria-label={`Aksi lain untuk ${item.name}`}
        aria-haspopup="menu"
        aria-expanded={menuId === item.id}
        onClick={() => setMenuId(menuId === item.id ? null : item.id)}
      >
        <Icon name="more" size={18} />
      </button>
      {menuId === item.id && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={() => void toggleActive(item)}>
            {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-danger"
            onClick={() => {
              setMenuId(null);
              setToDelete(item);
            }}
          >
            Hapus…
          </button>
        </div>
      )}
    </div>
  );

  const deleteBlocked = toDelete !== null && toDelete.barbers > 0;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" data-hydrated={String(hydrated)}>
        {announce}
      </p>

      <div className="only-lg" role="table" aria-label="Daftar cabang">
        <div role="row" className="thr branch-grid">
          <span role="columnheader">
            <span className="sr-only">Urutan</span>
          </span>
          <span role="columnheader">#</span>
          <span role="columnheader">Nama</span>
          <span role="columnheader">Wilayah</span>
          <span role="columnheader">Kota</span>
          <span role="columnheader" className="r">
            Barber
          </span>
          <span role="columnheader">Status</span>
          <span role="columnheader" className="r">
            Aksi
          </span>
        </div>
        {items.map((item, index) => {
          const status = branchStatus(item);
          return (
            <div
              key={item.id}
              role="row"
              className={[
                'tr',
                'branch-grid',
                item.id === selectedId ? 'sel' : '',
                dragId === item.id ? 'dragging' : '',
                overId === item.id && dragId !== item.id ? 'drop-target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-branch-id={item.id}
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
                {canReorder ? (
                  <button
                    type="button"
                    className="ib grip"
                    aria-label={`Atur urutan ${item.name}, urutan ${index + 1} dari ${items.length}. Seret, atau tekan panah atas/bawah.`}
                    onKeyDown={(event) => onHandleKey(event, item.id, index)}
                  >
                    <Icon name="grip" size={16} />
                  </button>
                ) : null}
              </span>
              <span role="cell" className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {index + 1}
              </span>
              <span role="cell">
                <span className="branch-name">
                  {item.name}
                  {item.is_flagship && <span className="tag-pusat">Pusat</span>}
                </span>
              </span>
              <span role="cell">{REGION_LABEL[item.region]}</span>
              <span role="cell" className="muted">
                {item.city}
              </span>
              <span role="cell" className="r">
                {item.barbers}
              </span>
              <span role="cell">
                <span className={`bd ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
              </span>
              <span role="cell" className="r" style={{ whiteSpace: 'nowrap' }}>
                <a
                  className="btn-o btn-sm"
                  href={editHrefs[item.id]}
                  aria-label={`Edit ${item.name}`}
                >
                  Edit
                </a>{' '}
                {rowMenu(item)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="only-sm" style={{ padding: 12 }}>
        {items.map((item, index) => {
          const status = branchStatus(item);
          return (
            <article
              key={item.id}
              className="card"
              style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
              data-branch-id={item.id}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "'Montserrat',sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {item.name}
                    {item.is_flagship && <span className="tag-pusat">Pusat</span>}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5b6161' }}>
                    {REGION_LABEL[item.region]} · {item.city} · {item.barbers} barber
                  </p>
                </div>
                <span className={`bd ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  className="btn-o"
                  href={editHrefs[item.id]}
                  aria-label={`Edit ${item.name}`}
                  style={{ flex: 1 }}
                >
                  Edit
                </a>
                {canReorder && (
                  <>
                    <button
                      type="button"
                      className="btn-o"
                      style={{ padding: 0, width: 44 }}
                      aria-label={`Naikkan ${item.name}`}
                      disabled={index === 0}
                      onClick={() => move(item.id, index - 1)}
                    >
                      <Icon name="arrow-up" size={18} />
                    </button>
                    <button
                      type="button"
                      className="btn-o"
                      style={{ padding: 0, width: 44 }}
                      aria-label={`Turunkan ${item.name}`}
                      disabled={index === items.length - 1}
                      onClick={() => move(item.id, index + 1)}
                    >
                      <Icon name="arrow-down" size={18} />
                    </button>
                  </>
                )}
                {rowMenu(item)}
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={
          deleteBlocked
            ? `${toDelete.name} masih punya ${toDelete.barbers} barber`
            : `Hapus cabang ${toDelete?.name ?? ''}?`
        }
        description={
          deleteBlocked
            ? 'Cabang yang masih punya barber tidak bisa dihapus. Pindahkan barbernya ke cabang lain lewat halaman Barber & Harga, atau nonaktifkan cabang ini supaya tidak tampil di situs tapi datanya tetap ada.'
            : 'Cabang dihapus permanen beserta data ketersediaan layanannya. Tindakan ini tidak dapat dibatalkan. Jika hanya tutup sementara, nonaktifkan saja.'
        }
        confirmLabel={deleteBlocked ? null : 'Hapus'}
        secondary={
          toDelete && toDelete.is_active
            ? {
                label: 'Nonaktifkan saja',
                onClick: () => {
                  const target = toDelete;
                  setToDelete(null);
                  void toggleActive(target);
                },
              }
            : undefined
        }
        busy={busy}
        onConfirm={() => toDelete && void remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
