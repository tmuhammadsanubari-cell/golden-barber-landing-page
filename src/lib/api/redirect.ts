/**
 * Tujuan redirect setelah login hanya boleh halaman admin di situs ini.
 * Menolak URL absolut, "//host", backslash, dan jalur di luar /admin (open redirect).
 */
export function safeAdminRedirect(value: unknown, fallback = '/admin'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return fallback;
  if (!value.startsWith('/admin')) return fallback;
  if (value.includes('\\') || value.startsWith('//')) return fallback;
  for (const char of value) {
    if (char.charCodeAt(0) < 32) return fallback;
  }
  const rest = value.slice('/admin'.length);
  if (rest !== '' && !/^[/?#]/.test(rest)) return fallback;
  // Jangan kembali ke halaman login/reset setelah berhasil login.
  if (/^\/admin\/(login|reset-password)(?:[/?#]|$)/.test(value)) return fallback;
  return value;
}

/** IP klien untuk pembatas laju; "unknown" bila tidak tersedia (mis. saat dev). */
export function clientIp(context: { clientAddress: string }): string {
  try {
    return context.clientAddress || 'unknown';
  } catch {
    return 'unknown';
  }
}
