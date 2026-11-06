// Dialog berisi form/pilihan (Tambah Barber, Pindah cabang, Salin harga). Fokus terkunci di
// dalam dialog, Esc = batal, fokus kembali ke pemicu saat ditutup. Pola sama dengan ConfirmDialog.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon?: string;
  children: ReactNode;
  submitLabel: string;
  busy?: boolean;
  /** Dinonaktifkan sampai pilihan/isian lengkap. */
  canSubmit?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

export default function FormDialog({
  open,
  title,
  description,
  icon = 'plus',
  children,
  submitLabel,
  busy = false,
  canSubmit = true,
  onSubmit,
  onCancel,
}: Props) {
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Fokus ke isian pertama bila ada; kalau tidak, tombol Batal.
    const first = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea');
    (first ?? dialogRef.current?.querySelector<HTMLElement>('button'))?.focus();
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
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
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
        className="dialog dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        aria-describedby={description ? `${uid}-d` : undefined}
      >
        <span className="dialog-icon dialog-icon-info" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <h2 id={`${uid}-t`} className="h3" style={{ fontSize: 19 }}>
          {title}
        </h2>
        {description && (
          <p
            id={`${uid}-d`}
            style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#5B6161' }}
          >
            {description}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !busy) onSubmit();
          }}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {children}
          <div className="dialog-actions">
            <button type="button" className="btn-o" onClick={onCancel} disabled={busy}>
              Batal
            </button>
            <button type="submit" className="btn" disabled={busy || !canSubmit}>
              {busy ? 'Memproses…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
