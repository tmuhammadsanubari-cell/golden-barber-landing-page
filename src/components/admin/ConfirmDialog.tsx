// Dialog konfirmasi (mockup Admin-State, bagian 4). Fokus terkunci di dalam dialog,
// Esc = batal, fokus kembali ke pemicu saat ditutup.
import { useEffect, useRef, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';

interface Props {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  /** Aksi tengah opsional, mis. "Nonaktifkan saja". */
  secondary?: { label: string; onClick: () => void };
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Hapus',
  secondary,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="overlay" onKeyDown={onKeyDown}>
      <div
        ref={dialogRef}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <span className="dialog-icon" aria-hidden="true">
          <Icon name="trash" size={22} />
        </span>
        <h2 id="confirm-title" className="h3" style={{ fontSize: 19 }}>
          {title}
        </h2>
        <p
          id="confirm-desc"
          style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#5B6161' }}
        >
          {description}
        </p>
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn-o"
            onClick={onCancel}
            disabled={busy}
          >
            Batal
          </button>
          {secondary && (
            <button type="button" className="btn-o" onClick={secondary.onClick} disabled={busy}>
              {secondary.label}
            </button>
          )}
          <button type="button" className="btn-d" onClick={onConfirm} disabled={busy}>
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
