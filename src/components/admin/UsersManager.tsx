// Pengguna admin (PRD F-22; tanpa mockup, pola daftar admin): daftar, undang lewat email, ubah
// peran, aktif/nonaktifkan. Halaman dan API hanya untuk Super Admin. Aturan "minimal satu Super
// Admin aktif" dijaga server; akun sendiri tidak diubah dari sini.
import { useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormDialog from '@/components/admin/FormDialog';
import Icon from '@/components/ui/Icon';
import { callApi } from '@/lib/admin/client';
import { formatLeadDate } from '@/lib/admin/leads';
import { showToast } from '@/lib/admin/toast';
import { initialsOf, usersSummary } from '@/lib/admin/users';
import { useHydrated } from '@/lib/admin/use-hydrated';
import {
  ROLES,
  ROLE_LABEL,
  inviteSchema,
  type Role,
} from '@/lib/validation/admin-users';

export interface UserItem {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

type Dialog = { kind: 'invite' } | { kind: 'deactivate'; id: string } | null;

export default function UsersManager({
  initial,
  currentUserId,
}: {
  initial: UserItem[];
  currentUserId: string;
}) {
  const hydrated = useHydrated();
  const [users, setUsers] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const target = dialog?.kind === 'deactivate' ? (users.find((u) => u.id === dialog.id) ?? null) : null;

  /** PATCH; mengembalikan true bila sukses. Pesan galat server (mis. Super Admin terakhir) ditampilkan. */
  async function patch(user: UserItem, change: { role?: Role; is_active?: boolean }, title: string) {
    const result = await callApi<UserItem>('PATCH', `/api/admin/users/${user.id}`, change);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal mengubah akun', message: result.error.message });
      return false;
    }
    setUsers((current) => current.map((row) => (row.id === user.id ? result.data : row)));
    showToast({ kind: 'success', title });
    return true;
  }

  return (
    <div data-hydrated={hydrated ? 'true' : 'false'} data-users>
      <div className="page-head">
        <div>
          <h1 className="h1">Pengguna Admin</h1>
          <p className="page-sub" data-count-summary>
            {usersSummary(users)}.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setDialog({ kind: 'invite' })}>
          <Icon name="plus" size={18} />
          Undang Admin
        </button>
      </div>

      <ul className="crud-list" aria-label="Daftar admin">
        {users.map((user) => {
          const self = user.id === currentUserId;
          return (
            <li
              key={user.id}
              className={`card crud-row usr-row ${user.is_active ? '' : 'off'}`}
              data-user-id={user.id}
              data-email={user.email}
            >
              <div className="usr-main">
                <span className="usr-avatar" aria-hidden="true">
                  {initialsOf(user.full_name)}
                </span>
                <div className="crud-main">
                  <p className="crud-title">
                    <strong>{user.full_name}</strong>
                    {self && <span className="tag-pusat">Anda</span>}
                    {!user.is_active && <span className="bd b-err">Nonaktif</span>}
                  </p>
                  <p className="crud-meta">{user.email}</p>
                  <p className="crud-meta">Bergabung {formatLeadDate(user.created_at)}</p>
                </div>
              </div>
              <div className="usr-side">
                <div>
                  <label className="sr-only" htmlFor={`role-${user.id}`}>
                    Peran {user.full_name}
                  </label>
                  <select
                    id={`role-${user.id}`}
                    className="sel"
                    value={user.role}
                    disabled={self}
                    title={self ? 'Akun Anda sendiri tidak bisa diubah dari sini.' : undefined}
                    onChange={(event) =>
                      void patch(
                        user,
                        { role: event.target.value as Role },
                        `Peran ${user.full_name} menjadi ${ROLE_LABEL[event.target.value as Role]}`,
                      )
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="crud-switch">
                  <button
                    type="button"
                    className={`sw${user.is_active ? ' on' : ''}`}
                    role="switch"
                    aria-checked={user.is_active}
                    aria-label={`Akses ${user.full_name}`}
                    disabled={self}
                    title={self ? 'Akun Anda sendiri tidak bisa diubah dari sini.' : undefined}
                    onClick={() =>
                      user.is_active
                        ? setDialog({ kind: 'deactivate', id: user.id })
                        : void patch(user, { is_active: true }, `${user.full_name} diaktifkan kembali`)
                    }
                  />
                  <span className={`gal-state${user.is_active ? ' on' : ''}`}>
                    {user.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <InviteDialog
        key={dialog?.kind === 'invite' ? 'invite-open' : 'invite-closed'}
        open={dialog?.kind === 'invite'}
        onClose={() => setDialog(null)}
        onInvited={(user) => {
          setUsers((current) => [...current, user]);
          setDialog(null);
          showToast({
            kind: 'success',
            title: `Undangan dikirim ke ${user.email}`,
            message: 'Penerima membuat password lewat tautan di email.',
          });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'deactivate' && target !== null}
        title={`Nonaktifkan ${target?.full_name ?? 'admin'}?`}
        description={`${target?.full_name ?? 'Admin ini'} langsung tidak bisa masuk atau memakai panel admin. Datanya tetap ada dan akses bisa diaktifkan lagi kapan saja.`}
        confirmLabel="Nonaktifkan"
        icon="eye-off"
        busy={busy}
        onConfirm={async () => {
          if (!target) return;
          setBusy(true);
          await patch(target, { is_active: false }, `${target.full_name} dinonaktifkan`);
          setBusy(false);
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function InviteDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (user: UserItem) => void;
}) {
  const [values, setValues] = useState({ email: '', full_name: '', role: 'editor' as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  async function submit() {
    const parsed = inviteSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    const result = await callApi<UserItem>('POST', '/api/admin/users/invite', parsed.data);
    setBusy(false);
    if (!result.success) {
      setErrors({ ...result.error.details, _: result.error.message });
      return;
    }
    onInvited(result.data);
  }

  const err = (key: string) =>
    errors[key] ? (
      <p className="ferr" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <FormDialog
      open={open}
      icon="users"
      title="Undang admin"
      description="Undangan dikirim ke email ini. Penerima membuat password sendiri lewat tautan di email, lalu bisa masuk."
      submitLabel="Kirim Undangan"
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div>
        <label className="fl" htmlFor="inv-name">
          Nama lengkap
        </label>
        <input
          id="inv-name"
          className={`inp${errors.full_name ? ' err' : ''}`}
          maxLength={80}
          value={values.full_name}
          onChange={(event) => set('full_name', event.target.value)}
        />
        {err('full_name')}
      </div>
      <div>
        <label className="fl" htmlFor="inv-email">
          Email
        </label>
        <input
          id="inv-email"
          type="email"
          className={`inp${errors.email ? ' err' : ''}`}
          autoComplete="off"
          value={values.email}
          onChange={(event) => set('email', event.target.value)}
        />
        {err('email')}
      </div>
      <div>
        <label className="fl" htmlFor="inv-role">
          Peran
        </label>
        <select
          id="inv-role"
          className="sel"
          value={values.role}
          onChange={(event) => set('role', event.target.value)}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
        <p className="hint">
          Editor mengelola konten dan lead. Super Admin juga bisa menghapus lead dan mengelola akun
          admin.
        </p>
        {err('role')}
      </div>
      {errors._ && !errors.email && (
        <p className="ferr" role="alert">
          {errors._}
        </p>
      )}
    </FormDialog>
  );
}
