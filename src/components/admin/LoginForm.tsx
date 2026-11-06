// Form login admin + lupa password (mockup Admin-Login, PRD F-14).
import { useState, type SyntheticEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { forgotPasswordSchema, loginSchema } from '@/lib/validation/auth';

interface ApiError {
  success: false;
  error: { code: string; message: string; details: Record<string, string> };
}
interface ApiOk<T> {
  success: true;
  data: T;
}

const NETWORK_ERROR = 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.';

async function post<T>(url: string, body: unknown): Promise<ApiOk<T> | ApiError> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as ApiOk<T> | ApiError;
}

type Mode = 'login' | 'forgot' | 'sent';

export default function LoginForm({ redirect }: { redirect: string }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasError = formError !== null || Object.keys(fieldErrors).length > 0;

  async function submitLogin(event: SyntheticEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password, remember, redirect });
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const result = await post<{ redirect: string }>('/api/auth/login', parsed.data);
      if (result.success) {
        window.location.assign(result.data.redirect);
        return;
      }
      if (result.error.code === 'VALIDATION_ERROR') setFieldErrors(result.error.details);
      else setFormError(result.error.message);
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(event: SyntheticEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0]!.message });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const result = await post<{ message: string }>('/api/auth/forgot-password', parsed.data);
      if (result.success) setMode('sent');
      else setFormError(result.error.message);
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setFieldErrors({});
  };

  if (mode === 'sent') {
    return (
      <div className="auth-card">
        <div>
          <h1 className="h1" style={{ fontSize: 24, marginBottom: 6 }}>
            Cek email Anda
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5B6161' }}>
            Jika <strong>{email}</strong> terdaftar sebagai admin, tautan untuk mengatur ulang
            password sudah dikirim. Tautan hanya berlaku sebentar.
          </p>
        </div>
        <div className="alert alert-ok" role="status">
          <Icon name="check-circle" size={18} />
          <span>Belum ada email? Periksa folder spam, lalu coba kirim ulang.</span>
        </div>
        <button type="button" className="btn-o btn-block" onClick={() => switchMode('login')}>
          Kembali ke halaman masuk
        </button>
      </div>
    );
  }

  if (mode === 'forgot') {
    return (
      <form className="auth-card" onSubmit={submitForgot} noValidate>
        <div>
          <h1 className="h1" style={{ fontSize: 24, marginBottom: 6 }}>
            Lupa password
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5B6161' }}>
            Masukkan email akun Anda. Kami kirim tautan untuk mengatur ulang password.
          </p>
        </div>
        {formError && (
          <div className="alert" role="alert">
            <Icon name="alert-circle" size={18} />
            <span>{formError}</span>
          </div>
        )}
        <div>
          <label className="fl" htmlFor="fp-mail">
            Email
          </label>
          <input
            id="fp-mail"
            className={`inp ${fieldErrors.email ? 'err' : ''}`}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'fp-mail-err' : undefined}
          />
          {fieldErrors.email && (
            <p className="ferr" id="fp-mail-err">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Mengirim…' : 'Kirim tautan reset'}
        </button>
        <button type="button" className="btn-o" onClick={() => switchMode('login')}>
          Kembali
        </button>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={submitLogin} noValidate>
      <div>
        <h1 className="h1" style={{ fontSize: 26, marginBottom: 6 }}>
          Masuk ke Panel Admin
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#5B6161' }}>
          Gunakan akun yang diberikan oleh admin pusat.
        </p>
      </div>
      {formError && (
        <div className="alert" role="alert">
          <Icon name="alert-circle" size={18} />
          <span>
            <strong>{formError}</strong>
            {formError === 'Email atau password salah.' &&
              ' Periksa kembali, atau atur ulang password.'}
          </span>
        </div>
      )}
      <div>
        <label className="fl" htmlFor="lg-mail">
          Email
        </label>
        <input
          id="lg-mail"
          className={`inp ${fieldErrors.email || formError ? 'err' : ''}`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={hasError}
          aria-describedby={fieldErrors.email ? 'lg-mail-err' : undefined}
        />
        {fieldErrors.email && (
          <p className="ferr" id="lg-mail-err">
            {fieldErrors.email}
          </p>
        )}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label className="fl" htmlFor="lg-pw">
            Password
          </label>
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              minHeight: 44,
              color: '#1F6497',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Lupa password?
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            id="lg-pw"
            className={`inp ${fieldErrors.password || formError ? 'err' : ''}`}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={hasError}
            aria-describedby={fieldErrors.password ? 'lg-pw-err' : undefined}
            style={{ paddingRight: 52 }}
          />
          <button
            type="button"
            className="ib"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} />
          </button>
        </div>
        {fieldErrors.password && (
          <p className="ferr" id="lg-pw-err">
            {fieldErrors.password}
          </p>
        )}
      </div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 44,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          style={{ width: 18, height: 18, accentColor: '#1F6497', margin: 0 }}
        />
        Ingat saya di perangkat ini
      </label>
      <button className="btn" type="submit" disabled={busy} style={{ minHeight: 48 }}>
        {busy ? 'Memproses…' : 'Masuk'}
      </button>
      <p style={{ margin: 0, fontSize: 12, color: '#5B6161', textAlign: 'center' }}>
        Butuh akses? Hubungi admin pusat Golden Barber.
      </p>
    </form>
  );
}
