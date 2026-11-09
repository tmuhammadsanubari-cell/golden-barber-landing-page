export type AdminRole = 'super_admin' | 'editor';

/** Profil admin aktif yang dimuat middleware ke `Astro.locals.admin`. */
export interface AdminProfile {
  id: string;
  full_name: string;
  email: string;
  role: AdminRole;
}
