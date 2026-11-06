// Panel tambah/edit cabang (PRD F-16, mockup Admin-Cabang panel kanan). Validasi memakai skema
// Zod yang sama dengan server; error server (mis. slug bentrok) ditampilkan di isian terkait.
import { useId, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import Icon from '@/components/ui/Icon';
import { REGION_LABEL, type BranchFormValues, type Region } from '@/lib/admin/branches';
import { callApi } from '@/lib/admin/client';
import { showToast } from '@/lib/admin/toast';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { slugify } from '@/lib/slug';
import { branchInputSchema } from '@/lib/validation/admin-branches';

interface Props {
  /** `null` = cabang baru. */
  branchId: string | null;
  title: string;
  initial: BranchFormValues;
  /** Cabang pusat saat ini (untuk konfirmasi saat memindahkan badge "Pusat"). */
  flagship: { id: string; name: string } | null;
  photo: { src: string; placeholder: boolean } | null;
  barbers: number;
  /** Nomor WA utama situs, untuk petunjuk di isian "Nomor WA khusus". */
  mainPhone: string;
  closeHref: string;
}

type Errors = Partial<Record<keyof BranchFormValues, string>>;

const FIELD_ORDER: (keyof BranchFormValues)[] = [
  'name',
  'slug',
  'region',
  'address',
  'district',
  'city',
  'province',
  'postal_code',
  'maps_url',
  'maps_embed_url',
  'latitude',
  'longitude',
  'open_time',
  'close_time',
  'whatsapp_number',
  'internal_note',
];

const FIELD_LABEL: Partial<Record<keyof BranchFormValues, string>> = {
  name: 'Nama cabang',
  slug: 'Slug URL',
  address: 'Alamat jalan',
  city: 'Kota/Kabupaten',
  province: 'Provinsi',
  postal_code: 'Kode pos',
  maps_url: 'URL Google Maps',
  maps_embed_url: 'URL embed peta',
  latitude: 'Latitude',
  longitude: 'Longitude',
  open_time: 'Jam buka',
  close_time: 'Jam tutup',
  whatsapp_number: 'Nomor WA khusus',
};

const isField = (key: string): key is keyof BranchFormValues =>
  FIELD_ORDER.includes(key as never) || key in FIELD_LABEL;

export default function BranchForm({
  branchId,
  title,
  initial,
  flagship,
  photo,
  barbers,
  mainPhone,
  closeHref,
}: Props) {
  const uid = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<BranchFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(branchId !== null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [confirmFlagship, setConfirmFlagship] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = (name: string) => `${uid}-${name}`;

  function set<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !slugTouched) next.slug = slugify(String(value));
      return next;
    });
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  /** Kembalikan payload valid, atau isi `errors` dan fokus ke isian pertama yang salah. */
  function validate() {
    const parsed = branchInputSchema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: Errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (isField(key)) next[key] ??= issue.message;
    }
    setErrors(next);
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id(first))}`)?.focus();
    return null;
  }

  async function save() {
    const payload = validate();
    if (!payload) return;
    setBusy(true);
    const result = branchId
      ? await callApi<{ id: string }>('PUT', `/api/admin/branches/${branchId}`, payload)
      : await callApi<{ id: string }>('POST', '/api/admin/branches', payload);
    setBusy(false);

    if (!result.success) {
      const serverErrors: Errors = {};
      for (const [key, message] of Object.entries(result.error.details)) {
        if (isField(key)) serverErrors[key] = message;
      }
      if (Object.keys(serverErrors).length > 0) setErrors(serverErrors);
      showToast({ kind: 'error', title: 'Gagal menyimpan', message: result.error.message });
      return;
    }
    showToast({ kind: 'success', title: branchId ? 'Perubahan tersimpan' : 'Cabang ditambahkan' });
    const url = new URL(window.location.href);
    url.searchParams.delete('baru');
    url.searchParams.set('id', result.data.id);
    window.location.assign(url.pathname + url.search);
  }

  function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const movesFlagship = values.is_flagship && flagship !== null && flagship.id !== branchId;
    if (movesFlagship) {
      // Validasi dulu supaya dialog tidak muncul untuk form yang pasti ditolak.
      if (validate()) setConfirmFlagship(true);
      return;
    }
    void save();
  }

  const errorKeys = FIELD_ORDER.filter((key) => errors[key]);

  const field = (
    name: keyof BranchFormValues,
    label: string,
    input: (props: Record<string, unknown>) => ReactNode,
    extra?: { hint?: ReactNode; optional?: boolean },
  ) => {
    const error = errors[name];
    return (
      <div>
        <label className="fl" htmlFor={id(name)}>
          {label}
          {extra?.optional && <span className="opt"> (opsional)</span>}
        </label>
        {input({
          id: id(name),
          className: `inp${error ? ' err' : ''}`,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? id(`${name}-e`) : extra?.hint ? id(`${name}-h`) : undefined,
        })}
        {error ? (
          <p className="ferr" id={id(`${name}-e`)}>
            <Icon name="alert-circle" size={14} />
            {error}
          </p>
        ) : extra?.hint ? (
          <p className="hint" id={id(`${name}-h`)}>
            {extra.hint}
          </p>
        ) : null}
      </div>
    );
  };

  const text = (
    name: keyof BranchFormValues,
    label: string,
    extra?: Parameters<typeof field>[3] & {
      type?: string;
      inputMode?: 'numeric' | 'tel' | 'decimal';
      placeholder?: string;
      maxLength?: number;
    },
  ) =>
    field(
      name,
      label,
      (props) => (
        <input
          {...props}
          type={extra?.type ?? 'text'}
          inputMode={extra?.inputMode}
          placeholder={extra?.placeholder}
          maxLength={extra?.maxLength}
          value={String(values[name])}
          onChange={(event) => set(name, event.target.value as never)}
        />
      ),
      extra,
    );

  const toggles: { key: 'is_flagship' | 'is_new' | 'is_active'; label: string; desc: string }[] = [
    {
      key: 'is_flagship',
      label: 'Cabang Pusat',
      desc: 'Tampilkan badge "Pusat". Hanya satu cabang yang boleh jadi pusat.',
    },
    { key: 'is_new', label: 'Cabang Baru', desc: 'Tampilkan badge "Cabang Baru"' },
    { key: 'is_active', label: 'Aktif', desc: 'Cabang tampil di situs' },
  ];

  return (
    <aside className="panel" aria-labelledby={id('title')} data-hydrated={String(hydrated)}>
      <div className="panel-head">
        <div style={{ minWidth: 0 }}>
          <p className="lbl" style={{ marginBottom: 4 }}>
            {branchId ? 'Edit Cabang' : 'Cabang Baru'}
          </p>
          <h2 id={id('title')} className="h3" style={{ fontSize: 20, overflowWrap: 'anywhere' }}>
            {title}
          </h2>
        </div>
        <a className="ib" href={closeHref} aria-label="Tutup panel" style={{ flex: 'none' }}>
          <Icon name="close" size={20} />
        </a>
      </div>

      {errorKeys.length > 0 && (
        <div role="alert" className="alert" style={{ margin: '16px 24px 0' }}>
          <Icon name="alert-circle" size={18} />
          <span>
            <strong>{errorKeys.length} isian perlu diperbaiki</strong> sebelum disimpan:{' '}
            {errorKeys.map((key) => FIELD_LABEL[key] ?? key).join(', ')}.
          </span>
        </div>
      )}

      <form id={id('form')} ref={formRef} onSubmit={onSubmit} noValidate className="panel-body">
        <div className="grp" style={{ borderTop: 0 }}>
          <p className="sec">Identitas</p>
          {text('name', 'Nama cabang', { maxLength: 80 })}
          {field(
            'slug',
            'Slug URL',
            (props) => (
              <div style={{ display: 'flex' }}>
                <span className="addon">/cabang/</span>
                <input
                  {...props}
                  style={{ borderRadius: '0 5px 5px 0' }}
                  value={values.slug}
                  maxLength={60}
                  onChange={(event) => {
                    setSlugTouched(true);
                    set('slug', event.target.value.toLowerCase());
                  }}
                />
              </div>
            ),
            {
              hint: 'Hanya huruf kecil, angka, dan tanda hubung. Mengubah slug mengubah alamat halaman cabang.',
            },
          )}
          {field('region', 'Wilayah', (props) => (
            <select
              {...props}
              value={values.region}
              onChange={(event) => set('region', event.target.value as Region)}
            >
              {(Object.keys(REGION_LABEL) as Region[]).map((key) => (
                <option key={key} value={key}>
                  {REGION_LABEL[key]}
                </option>
              ))}
            </select>
          ))}
        </div>

        <div className="grp">
          <p className="sec">Alamat</p>
          {field('address', 'Alamat jalan', (props) => (
            <textarea
              {...props}
              maxLength={200}
              value={values.address}
              onChange={(event) => set('address', event.target.value)}
            />
          ))}
          <div className="two-col">
            {text('district', 'Kecamatan', { optional: true })}
            {text('city', 'Kota/Kabupaten')}
            {text('province', 'Provinsi')}
            {text('postal_code', 'Kode pos', {
              inputMode: 'numeric',
              maxLength: 5,
              optional: true,
            })}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={values.address_incomplete}
              onChange={(event) => set('address_incomplete', event.target.checked)}
            />
            <span>
              Alamat belum lengkap
              <span className="check-sub">
                Situs menampilkan catatan "Alamat lengkap: tanyakan via WhatsApp".
              </span>
            </span>
          </label>
        </div>

        <div className="grp">
          <p className="sec">Peta</p>
          {text('maps_url', 'URL Google Maps', {
            type: 'url',
            optional: true,
            hint: 'Dipakai tombol "Petunjuk Arah".',
          })}
          {text('maps_embed_url', 'URL embed peta', {
            type: 'url',
            optional: true,
            hint: 'Salin dari Google Maps › Bagikan › Sematkan peta. Kosong = situs menampilkan peta ilustrasi.',
          })}
          <div className="two-col">
            {text('latitude', 'Latitude', {
              inputMode: 'decimal',
              optional: true,
              placeholder: '-6.8915',
            })}
            {text('longitude', 'Longitude', {
              inputMode: 'decimal',
              optional: true,
              placeholder: '107.6107',
            })}
          </div>
        </div>

        <div className="grp">
          <p className="sec">Jam Operasional &amp; Kontak</p>
          <div className="two-col">
            {text('open_time', 'Jam buka', { type: 'time' })}
            {text('close_time', 'Jam tutup', { type: 'time' })}
          </div>
          {text('whatsapp_number', 'Nomor WA khusus', {
            type: 'tel',
            inputMode: 'tel',
            optional: true,
            placeholder: '08xx-xxxx-xxxx',
            hint: `Kosongkan untuk memakai nomor utama ${mainPhone}.`,
          })}
        </div>

        <div className="grp">
          <p className="sec">Status</p>
          {toggles.map((toggle) => {
            const on = values[toggle.key];
            return (
              <div key={toggle.key} className="toggle-row">
                <span id={id(toggle.key)} style={{ fontSize: 14 }}>
                  <strong style={{ display: 'block' }}>{toggle.label}</strong>
                  <span style={{ fontSize: 12, color: '#5b6161' }}>{toggle.desc}</span>
                </span>
                <button
                  type="button"
                  className={`sw${on ? ' on' : ''}`}
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={id(toggle.key)}
                  onClick={() => set(toggle.key, !on)}
                />
              </div>
            );
          })}
          {branchId && !values.is_active && barbers > 0 && (
            <p className="hint" style={{ marginTop: 0 }}>
              {barbers} barber di cabang ini ikut disembunyikan dari situs selama cabang nonaktif.
            </p>
          )}
        </div>

        <div className="grp">
          <p className="sec">Foto Cabang</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px minmax(0,1fr)',
              gap: 12,
              alignItems: 'center',
            }}
          >
            {photo ? (
              <img
                src={photo.src}
                alt={`Foto cabang ${values.name || 'baru'}${photo.placeholder ? ' (ilustrasi)' : ''}`}
                width={120}
                height={90}
                style={{
                  width: 120,
                  height: 90,
                  objectFit: 'cover',
                  borderRadius: 5,
                  background: '#c4c8c8',
                }}
              />
            ) : (
              <div
                className="ph"
                role="img"
                aria-label="Belum ada foto"
                style={{ height: 90, borderRadius: 5 }}
              />
            )}
            <p className="hint" style={{ margin: 0 }}>
              {photo?.placeholder
                ? 'Foto ini ilustrasi sementara (tampil dengan label "Ilustrasi" di situs). '
                : ''}
              Unggah foto asli akan tersedia bersama modul Galeri.
            </p>
          </div>
        </div>

        <div className="grp">
          <p className="sec">Catatan Internal</p>
          {field(
            'internal_note',
            'Catatan untuk tim',
            (props) => (
              <textarea
                {...props}
                maxLength={1000}
                value={values.internal_note}
                onChange={(event) => set('internal_note', event.target.value)}
              />
            ),
            { optional: true, hint: 'Hanya terlihat oleh admin. Tidak tampil di situs.' },
          )}
        </div>
      </form>

      <div className="panel-foot">
        <span style={{ fontSize: 12, color: '#5b6161' }}>
          Perubahan tayang setelah dipublikasikan
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn-o" href={closeHref}>
            Batal
          </a>
          <button type="submit" form={id('form')} className="btn" disabled={busy}>
            {busy ? 'Menyimpan…' : branchId ? 'Simpan Perubahan' : 'Simpan Cabang'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmFlagship}
        icon="pin"
        danger={false}
        title={`Jadikan ${values.name || 'cabang ini'} cabang pusat?`}
        description={`Hanya satu cabang yang boleh jadi pusat. Badge "Pusat" di ${flagship?.name ?? 'cabang lama'} akan dilepas.`}
        confirmLabel="Ya, jadikan pusat"
        busy={busy}
        onConfirm={() => {
          setConfirmFlagship(false);
          void save();
        }}
        onCancel={() => setConfirmFlagship(false)}
      />
    </aside>
  );
}
