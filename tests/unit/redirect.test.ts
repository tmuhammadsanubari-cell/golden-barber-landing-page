import { describe, expect, it } from 'vitest';
import { safeAdminRedirect } from '@/lib/api/redirect';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '@/lib/validation/auth';

describe('safeAdminRedirect', () => {
  it('menerima jalur admin', () => {
    expect(safeAdminRedirect('/admin')).toBe('/admin');
    expect(safeAdminRedirect('/admin/barber')).toBe('/admin/barber');
    expect(safeAdminRedirect('/admin/leads?status=new#x')).toBe('/admin/leads?status=new#x');
  });

  it('menolak open redirect dan jalur lain', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/admin\\..\\x',
      '/administrator',
      '/api/admin/x',
      '/',
      '',
      undefined,
      42,
      '/admin\n/x',
    ]) {
      expect(safeAdminRedirect(bad), String(bad)).toBe('/admin');
    }
  });

  it('tidak kembali ke login/reset-password', () => {
    expect(safeAdminRedirect('/admin/login?redirect=/admin')).toBe('/admin');
    expect(safeAdminRedirect('/admin/reset-password')).toBe('/admin');
  });
});

describe('skema auth', () => {
  it('login: email & password wajib, pesan Indonesia', () => {
    const r = loginSchema.safeParse({ email: 'bukan-email', password: '' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const msgs = Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
    expect(msgs.email).toBe('Format email tidak valid.');
    expect(msgs.password).toBe('Password wajib diisi.');
    expect(loginSchema.safeParse({ email: ' a@b.id ', password: 'x' }).success).toBe(true);
  });

  it('lupa password: email valid', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.id' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('reset password: minimal 8 karakter dan konfirmasi sama', () => {
    expect(resetPasswordSchema.safeParse({ password: 'pendek', confirm: 'pendek' }).success).toBe(
      false,
    );
    const mismatch = resetPasswordSchema.safeParse({
      password: 'rahasia123',
      confirm: 'beda12345',
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]!.message).toBe('Konfirmasi password tidak sama.');
    }
    expect(
      resetPasswordSchema.safeParse({ password: 'rahasia123', confirm: 'rahasia123' }).success,
    ).toBe(true);
  });
});
