// GET /api/auth/me: profil admin yang sedang login.
import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/api/guards';
import { ok } from '@/lib/api/respond';

export const prerender = false;

export const GET: APIRoute = ({ locals }) => {
  const admin = requireAdmin(locals);
  return admin instanceof Response ? admin : ok(admin);
};
