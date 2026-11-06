// Guard peran untuk endpoint /api/admin/* (PRD 4.4). Middleware sudah mengisi `locals.admin`;
// guard ini memastikan ada dan peran cukup.
//
// Pemakaian:
//   const admin = requireAdmin(locals);
//   if (admin instanceof Response) return admin;
import type { AdminProfile } from '@/types/admin';
import { fail } from './respond';

export function requireAdmin(locals: { admin: AdminProfile | null }): AdminProfile | Response {
  return locals.admin ?? fail('UNAUTHORIZED');
}

export function requireSuperAdmin(locals: { admin: AdminProfile | null }): AdminProfile | Response {
  const admin = requireAdmin(locals);
  if (admin instanceof Response) return admin;
  return admin.role === 'super_admin' ? admin : fail('FORBIDDEN');
}
