// Urut ulang daftar konten di island admin: seret (mouse), panah keyboard di pegangan, dan
// `move` untuk tombol naik/turun di layar sentuh. Simpan optimistis ke PATCH {endpoint}; gagal →
// urutan lama dipulihkan.
import { useState } from 'react';
import { moveItem } from './branches';
import { callApi } from './client';
import { showToast } from './toast';

interface Options<T> {
  items: T[];
  setItems: (next: T[]) => void;
  /** PATCH ... /reorder yang menerima [{ id, sort_order }] semua item. */
  endpoint: string;
  /** Nama item untuk pengumuman pembaca layar. */
  label: (item: T) => string;
}

export function useSortable<T extends { id: string; sort_order: number }>({
  items,
  setItems,
  endpoint,
  label,
}: Options<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  async function persist(next: T[], message: string) {
    const previous = items;
    setItems(next.map((item, index) => ({ ...item, sort_order: index + 1 })));
    const result = await callApi(
      'PATCH',
      endpoint,
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
    void persist(
      moveItem(items, from, to),
      `${label(items[from]!)} dipindah ke urutan ${to + 1} dari ${items.length}.`,
    );
  }

  function onHandleKey(event: React.KeyboardEvent, id: string, index: number) {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    move(id, index + step);
  }

  /** Atribut seret untuk elemen baris. */
  function rowProps(id: string, index: number) {
    return {
      draggable: true,
      onDragStart: (event: React.DragEvent) => {
        setDragId(id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      },
      onDragOver: (event: React.DragEvent) => {
        if (!dragId) return;
        event.preventDefault();
        setOverId(id);
      },
      onDrop: (event: React.DragEvent) => {
        if (!dragId) return;
        event.preventDefault();
        if (dragId !== id) move(dragId, index);
        setDragId(null);
        setOverId(null);
      },
      onDragEnd: () => {
        setDragId(null);
        setOverId(null);
      },
    };
  }

  const rowClass = (id: string) =>
    [dragId === id ? 'dragging' : '', overId === id && dragId !== id ? 'drop-target' : '']
      .filter(Boolean)
      .join(' ');

  return { announce, move, onHandleKey, rowProps, rowClass };
}
