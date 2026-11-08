// Fungsi murni untuk manajemen pengguna admin (PRD F-22).
import type { Role } from '@/lib/validation/admin-users';

export interface UserLike {
  id: string;
  role: Role;
  is_active: boolean;
}

export const LAST_SUPER_ADMIN_MESSAGE =
  'Harus ada minimal satu Super Admin aktif. Jadikan akun lain Super Admin dulu.';

/** Jumlah Super Admin yang aktif. */
export function activeSuperAdmins(users: UserLike[]): number {
  return users.filter((user) => user.role === 'super_admin' && user.is_active).length;
}

/**
 * Apakah perubahan ini membuat tidak ada lagi Super Admin aktif? (PRD F-22: Super Admin terakhir
 * tidak boleh dinonaktifkan atau diturunkan.) `users` = kondisi SEBELUM perubahan.
 */
export function wouldRemoveLastSuperAdmin(
  users: UserLike[],
  id: string,
  patch: { role?: Role; is_active?: boolean },
): boolean {
  const after = users.map((user) => (user.id === id ? { ...user, ...patch } : user));
  return activeSuperAdmins(users) > 0 && activeSuperAdmins(after) === 0;
}

/** Tautan tujuan undangan: halaman atur password di situs ini (harus ada di Redirect URLs Supabase). */
export function inviteRedirectUrl(siteUrl: string | undefined, requestOrigin: string): string {
  let base = requestOrigin;
  if (siteUrl) {
    try {
      base = new URL(siteUrl).origin;
    } catch {
      // PUBLIC_SITE_URL tidak valid: pakai origin permintaan.
    }
  }
  return `${base}/admin/reset-password`;
}

/** "3 admin · 3 aktif · 1 Super Admin aktif" (teks bawah judul halaman). */
export function usersSummary(users: UserLike[]): string {
  if (users.length === 0) return 'Belum ada admin.';
  const active = users.filter((user) => user.is_active).length;
  return `${users.length} admin · ${active} aktif · ${activeSuperAdmins(users)} Super Admin aktif`;
}

/** Huruf awal untuk avatar: "Admin Pusat" → "AP". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}
