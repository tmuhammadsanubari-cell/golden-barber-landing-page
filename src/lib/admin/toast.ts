// Toast panel admin. Store kecil yang dibaca ToastHost; bisa dipanggil dari island mana pun.
import { atom } from 'nanostores';

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  /** Tombol aksi opsional, mis. "Coba lagi". */
  action?: { label: string; onClick: () => void };
}

export const toasts = atom<Toast[]>([]);

let nextId = 1;
const AUTO_DISMISS_MS = 6000;

export function dismissToast(id: number): void {
  toasts.set(toasts.get().filter((toast) => toast.id !== id));
}

export function showToast(input: Omit<Toast, 'id'>): number {
  const id = nextId++;
  toasts.set([...toasts.get(), { ...input, id }]);
  // Error dengan aksi tetap tampil sampai ditutup; lainnya hilang sendiri.
  if (input.kind === 'success' || !input.action) {
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
  }
  return id;
}
