// Menampilkan toast dari store `toasts` (src/lib/admin/toast.ts). Dipasang sekali di AdminLayout.
import { useStore } from '@nanostores/react';
import Icon from '@/components/ui/Icon';
import { dismissToast, toasts } from '@/lib/admin/toast';

export default function ToastHost() {
  const items = useStore(toasts);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((toast) => {
        const isError = toast.kind === 'error';
        return (
          <div
            key={toast.id}
            className={`toast ${isError ? 'toast-err' : ''}`}
            role={isError ? 'alert' : 'status'}
          >
            <span style={{ color: isError ? '#B42318' : '#6FA9D6', display: 'inline-flex' }}>
              <Icon name={isError ? 'alert-circle' : 'check-circle'} size={22} />
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14 }}>{toast.title}</strong>
              {toast.message && <p>{toast.message}</p>}
            </div>
            {toast.action && (
              <button
                type="button"
                className="btn-o btn-sm"
                onClick={() => {
                  toast.action!.onClick();
                  dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="ib"
              aria-label="Tutup notifikasi"
              onClick={() => dismissToast(toast.id)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
