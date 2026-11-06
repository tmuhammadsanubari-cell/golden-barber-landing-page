// Form password baru setelah tautan reset ditukar menjadi sesi (PRD F-14).
import { useState, type SyntheticEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { PASSWORD_MIN, resetPasswordSchema } from '@/lib/validation/auth';

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as
        | { success: true; data: { redirect: string } }
        | {
            success: false;
            error: { code: string; message: string; details: Record<string, string> };
          };
      if (body.success) {
        window.location.assign(body.data.redirect);
        return;
      }
      if (body.error.code === 'VALIDATION_ERROR') setFieldErrors(body.error.details);
      else setFormError(body.error.message);
    } catch {
      setFormError('Koneksi bermasalah. Periksa internet Anda lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <div>
        <h1 className="h1" style={{ fontSize: 24, marginBottom: 6 }}>
          Atur password baru
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#5B6161' }}>
          Minimal {PASSWORD_MIN} karakter. Setelah disimpan, Anda langsung masuk ke panel admin.
        </p>
      </div>
      {formError && (
        <div className="alert" role="alert">
          <Icon name="alert-circle" size={18} />
          <span>{formError}</span>
        </div>
      )}
      <div>
        <label className="fl" htmlFor="rp-pw">
          Password baru
        </label>
        <input
          id="rp-pw"
          className={`inp ${fieldErrors.password ? 'err' : ''}`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'rp-pw-err' : undefined}
        />
        {fieldErrors.password && (
          <p className="ferr" id="rp-pw-err">
            {fieldErrors.password}
          </p>
        )}
      </div>
      <div>
        <label className="fl" htmlFor="rp-confirm">
          Ulangi password baru
        </label>
        <input
          id="rp-confirm"
          className={`inp ${fieldErrors.confirm ? 'err' : ''}`}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={Boolean(fieldErrors.confirm)}
          aria-describedby={fieldErrors.confirm ? 'rp-confirm-err' : undefined}
        />
        {fieldErrors.confirm && (
          <p className="ferr" id="rp-confirm-err">
            {fieldErrors.confirm}
          </p>
        )}
      </div>
      <button className="btn" type="submit" disabled={busy} style={{ minHeight: 48 }}>
        {busy ? 'Menyimpan…' : 'Simpan password'}
      </button>
    </form>
  );
}
