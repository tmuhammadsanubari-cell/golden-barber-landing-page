// Akses data pengguna admin (PRD F-22). Daftar dibaca dengan klien sesi (RLS: Super Admin membaca
// semua); tulis dan Auth Admin API lewat service role, HANYA dari endpoint yang sudah
// memeriksa `requireSuperAdmin`.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbResult } from '@/lib/api/db-result';
import type { InviteInput, UserPatch } from '@/lib/validation/admin-users';
import type { Database } from '@/types/database';
import { LAST_SUPER_ADMIN_MESSAGE, wouldRemoveLastSuperAdmin } from './users';

type Client = SupabaseClient<Database>;
export type AdminUserRow = Database['public']['Tables']['admin_profiles']['Row'];

export async function listAdminUsers(supabase: Client): Promise<AdminUserRow[]> {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .order('created_at')
    .order('email');
  if (error) throw error;
  return data ?? [];
}

/** Mengirim undangan dan mengembalikan id akun Auth. Bisa diganti di tes (tanpa mengirim email). */
export type Inviter = (args: {
  email: string;
  fullName: string;
  redirectTo: string;
}) => Promise<{ id: string } | { error: 'ALREADY_REGISTERED' }>;

/** Undangan sungguhan: Supabase mengirim email berisi tautan atur password. */
export const supabaseInviter =
  (service: Client): Inviter =>
  async ({ email, fullName, redirectTo }) => {
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo,
    });
    if (error) {
      if (/already.*(registered|exists)|email_exists/i.test(`${error.code ?? ''} ${error.message}`)) {
        return { error: 'ALREADY_REGISTERED' };
      }
      throw error;
    }
    return { id: data.user.id };
  };

const EMAIL_TAKEN = {
  ok: false,
  code: 'CONFLICT',
  message: 'Email ini sudah terdaftar. Pakai email lain, atau ubah akun yang sudah ada.',
  details: { email: 'Email sudah terdaftar.' },
} as const;

/** Undang admin baru: akun Auth (undangan) + baris `admin_profiles` aktif dengan peran dipilih. */
export async function inviteAdminUser(
  service: Client,
  input: InviteInput,
  redirectTo: string,
  inviter: Inviter = supabaseInviter(service),
): Promise<DbResult<AdminUserRow>> {
  const existing = await service
    .from('admin_profiles')
    .select('id')
    .ilike('email', input.email)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return EMAIL_TAKEN;

  const invited = await inviter({ email: input.email, fullName: input.full_name, redirectTo });
  if ('error' in invited) return EMAIL_TAKEN;

  const { data, error } = await service
    .from('admin_profiles')
    .insert({
      id: invited.id,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) {
    // Jangan tinggalkan akun Auth yatim yang tak bisa dipakai maupun diundang ulang.
    await service.auth.admin.deleteUser(invited.id);
    throw error;
  }
  return { ok: true, data };
}

/** Ubah peran dan/atau status akses. Minimal satu Super Admin aktif harus tersisa. */
export async function patchAdminUser(
  service: Client,
  id: string,
  patch: UserPatch,
): Promise<DbResult<AdminUserRow>> {
  const all = await service.from('admin_profiles').select('id, role, is_active');
  if (all.error) throw all.error;
  const users = all.data ?? [];
  if (!users.some((user) => user.id === id)) return { ok: false, code: 'NOT_FOUND' };
  if (wouldRemoveLastSuperAdmin(users, id, patch)) {
    return { ok: false, code: 'CONFLICT', message: LAST_SUPER_ADMIN_MESSAGE };
  }
  const { data, error } = await service
    .from('admin_profiles')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data };
}
