import { describe, expect, it } from 'vitest';
import {
  activeSuperAdmins,
  initialsOf,
  inviteRedirectUrl,
  usersSummary,
  wouldRemoveLastSuperAdmin,
  type UserLike,
} from '@/lib/admin/users';
import { inviteSchema, userPatchSchema } from '@/lib/validation/admin-users';

const a: UserLike = { id: 'a', role: 'super_admin', is_active: true };
const b: UserLike = { id: 'b', role: 'editor', is_active: true };
const c: UserLike = { id: 'c', role: 'super_admin', is_active: true };

describe('wouldRemoveLastSuperAdmin (PRD F-22)', () => {
  it('Super Admin satu-satunya tidak boleh dinonaktifkan atau diturunkan', () => {
    expect(wouldRemoveLastSuperAdmin([a, b], 'a', { is_active: false })).toBe(true);
    expect(wouldRemoveLastSuperAdmin([a, b], 'a', { role: 'editor' })).toBe(true);
    expect(wouldRemoveLastSuperAdmin([a, b], 'a', { role: 'editor', is_active: false })).toBe(true);
  });
  it('boleh bila masih ada Super Admin aktif lain', () => {
    expect(wouldRemoveLastSuperAdmin([a, b, c], 'a', { is_active: false })).toBe(false);
    expect(wouldRemoveLastSuperAdmin([a, c], 'c', { role: 'editor' })).toBe(false);
  });
  it('Super Admin lain yang nonaktif tidak dihitung', () => {
    const off: UserLike = { ...c, is_active: false };
    expect(wouldRemoveLastSuperAdmin([a, off], 'a', { is_active: false })).toBe(true);
  });
  it('mengubah Editor atau tanpa perubahan berarti tidak menyentuh Super Admin', () => {
    expect(wouldRemoveLastSuperAdmin([a, b], 'b', { is_active: false })).toBe(false);
    expect(wouldRemoveLastSuperAdmin([a, b], 'a', { role: 'super_admin', is_active: true })).toBe(false);
  });
  it('menaikkan Editor jadi Super Admin selalu aman', () => {
    expect(wouldRemoveLastSuperAdmin([a, b], 'b', { role: 'super_admin' })).toBe(false);
  });
  it('tanpa Super Admin aktif sejak awal tidak dianggap "menghapus yang terakhir"', () => {
    expect(wouldRemoveLastSuperAdmin([b], 'b', { is_active: false })).toBe(false);
  });
  it('activeSuperAdmins', () => {
    expect(activeSuperAdmins([a, b, c, { ...c, id: 'd', is_active: false }])).toBe(2);
  });
});

describe('skema undangan dan ubah akun', () => {
  const ok = { email: 'Staf@Contoh.COM ', full_name: ' Rizky Aditya ', role: 'editor' };
  it('email dinormalkan huruf kecil dan dipangkas; nama dipangkas', () => {
    expect(inviteSchema.parse(ok)).toEqual({
      email: 'staf@contoh.com',
      full_name: 'Rizky Aditya',
      role: 'editor',
    });
  });
  it('menolak email salah, nama kosong/pendek, peran tak dikenal', () => {
    expect(inviteSchema.safeParse({ ...ok, email: 'bukan-email' }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...ok, email: '' }).error?.issues[0]?.message).toBe('Email wajib diisi.');
    expect(inviteSchema.safeParse({ ...ok, full_name: '' }).error?.issues[0]?.message).toBe('Nama lengkap wajib diisi.');
    expect(inviteSchema.safeParse({ ...ok, full_name: 'A' }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...ok, role: 'owner' }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...ok, role: undefined }).success).toBe(false);
  });
  it('patch: peran dan/atau status; kosong dan field asing ditolak', () => {
    expect(userPatchSchema.safeParse({ role: 'super_admin' }).success).toBe(true);
    expect(userPatchSchema.safeParse({ is_active: false }).success).toBe(true);
    expect(userPatchSchema.safeParse({ role: 'editor', is_active: true }).success).toBe(true);
    expect(userPatchSchema.safeParse({}).success).toBe(false);
    expect(userPatchSchema.safeParse({ email: 'x@y.com' }).success).toBe(false);
    expect(userPatchSchema.safeParse({ role: 'admin' }).success).toBe(false);
    expect(userPatchSchema.safeParse({ is_active: 'ya' }).success).toBe(false);
  });
});

describe('helper', () => {
  it('inviteRedirectUrl: PUBLIC_SITE_URL bila sah, kalau tidak origin permintaan', () => {
    expect(inviteRedirectUrl('https://situs.example/path', 'http://localhost:4321')).toBe(
      'https://situs.example/admin/reset-password',
    );
    expect(inviteRedirectUrl(undefined, 'http://localhost:4321')).toBe(
      'http://localhost:4321/admin/reset-password',
    );
    expect(inviteRedirectUrl('bukan url', 'http://localhost:4321')).toBe(
      'http://localhost:4321/admin/reset-password',
    );
  });
  it('usersSummary dan initialsOf', () => {
    expect(usersSummary([])).toBe('Belum ada admin.');
    expect(usersSummary([a, b, { ...c, is_active: false }])).toBe('3 admin · 2 aktif · 1 Super Admin aktif');
    expect(initialsOf('Admin Pusat')).toBe('AP');
    expect(initialsOf('  budi  ')).toBe('B');
    expect(initialsOf('a b c')).toBe('AB');
  });
});
