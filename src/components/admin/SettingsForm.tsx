// Pengaturan Situs (PRD F-21, mockup Admin-Pengaturan): hero, kontak, template pesan WA, rating
// Google, teks Academy & Kemitraan, ditambah poin keunggulan dan teks "sudah termasuk" (PRD F-21).
// Semua perubahan disimpan sebagai draf lewat PUT /api/admin/settings/:key per bagian yang berubah;
// tayang di situs setelah dipublikasikan (PublishBar).
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { callApi } from '@/lib/admin/client';
import {
  TEMPLATE_META,
  fieldToPhone,
  insertPlaceholder,
  parseCount,
  parseRating,
  phoneToField,
  placeholdersFor,
  previewTemplate,
  ratingToField,
  sameValue,
} from '@/lib/admin/settings';
import { showToast } from '@/lib/admin/toast';
import { uploadImage } from '@/lib/admin/upload-client';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { mediaUrl } from '@/lib/media';
import {
  HIGHLIGHT_ICONS,
  SETTINGS_SCHEMAS,
  type EditableKey,
} from '@/lib/validation/admin-settings';
import type { WhatsAppTemplateKey } from '@/types/content';

// ---- bentuk data -----------------------------------------------------------------------------

interface Hero {
  title: string;
  subtitle: string;
  primary_cta: string;
  secondary_cta: string;
  image_path: string;
  image_is_placeholder: boolean;
}
interface Links {
  instagram: string;
  threads: string;
  linktree: string;
  academy_instagram: string;
}
interface Highlight {
  icon: string;
  title: string;
  description: string;
}
interface Academy {
  title: string;
  description: string;
  is_details_available: boolean;
}
interface Partnership {
  title: string;
  description: string;
}
interface RatingValue {
  rating: number;
  review_count: number;
  scope: string;
  updated_at: string;
}

/** Nilai tersimpan per kunci (bentuk yang dikirim/diterima API). */
export interface SettingsValues {
  hero: Hero;
  whatsapp_number: string;
  whatsapp_templates: Record<WhatsAppTemplateKey, string>;
  social_links: Links;
  google_rating: RatingValue;
  about_highlights: Highlight[];
  haircut_includes: string[];
  academy_section: Academy;
  partnership_section: Partnership;
}

/** Bentuk isian di form (angka dan nomor sebagai teks supaya bisa diketik bebas). */
interface Draft extends Omit<SettingsValues, 'whatsapp_number' | 'google_rating'> {
  phone: string;
  rating: { rating: string; review_count: string; scope: string; updated_at: string };
}

const toDraft = (values: SettingsValues): Draft => ({
  hero: values.hero,
  phone: phoneToField(values.whatsapp_number),
  whatsapp_templates: values.whatsapp_templates,
  social_links: values.social_links,
  rating: {
    rating: ratingToField(values.google_rating.rating),
    review_count: String(values.google_rating.review_count),
    scope: values.google_rating.scope,
    updated_at: values.google_rating.updated_at,
  },
  about_highlights: values.about_highlights,
  haircut_includes: values.haircut_includes,
  academy_section: values.academy_section,
  partnership_section: values.partnership_section,
});

const toValues = (draft: Draft): Record<EditableKey, unknown> => ({
  hero: draft.hero,
  whatsapp_number: fieldToPhone(draft.phone),
  whatsapp_templates: draft.whatsapp_templates,
  social_links: draft.social_links,
  google_rating: {
    rating: parseRating(draft.rating.rating),
    review_count: parseCount(draft.rating.review_count),
    scope: draft.rating.scope,
    updated_at: draft.rating.updated_at,
  },
  about_highlights: draft.about_highlights,
  haircut_includes: draft.haircut_includes,
  academy_section: draft.academy_section,
  partnership_section: draft.partnership_section,
});

const SECTIONS = [
  { id: 'st-hero', label: 'Hero', keys: ['hero'] },
  { id: 'st-kontak', label: 'Kontak', keys: ['whatsapp_number', 'social_links'] },
  { id: 'st-wa', label: 'Template Pesan WA', keys: ['whatsapp_templates'] },
  { id: 'st-rating', label: 'Rating Google', keys: ['google_rating'] },
  { id: 'st-teks', label: 'Teks Academy & Kemitraan', keys: ['academy_section', 'partnership_section'] },
  { id: 'st-poin', label: 'Keunggulan & Termasuk', keys: ['about_highlights', 'haircut_includes'] },
] as const satisfies readonly { id: string; label: string; keys: readonly EditableKey[] }[];

const HERO_DUMMY = '/images/dummy/hero.webp';

const ICON_LABEL: Record<string, string> = {
  'message-circle': 'Percakapan',
  droplets: 'Tetesan (hairwash)',
  clock: 'Jam',
  users: 'Orang',
  trophy: 'Piala',
  'heart-handshake': 'Peduli',
  scissors: 'Gunting',
  star: 'Bintang',
  pin: 'Lokasi',
};

/** "hero.title" → pesan, dari hasil validasi Zod per kunci. */
function validate(values: Record<EditableKey, unknown>, keys: readonly EditableKey[]) {
  const errors: Record<string, string> = {};
  for (const key of keys) {
    const parsed = SETTINGS_SCHEMAS[key].safeParse(values[key]);
    if (parsed.success) continue;
    for (const issue of parsed.error.issues) {
      // Galat tingkat nilai (mis. nomor WA, daftar kosong) memakai "_", sama dengan detail dari server.
      const path = [key, ...(issue.path.length > 0 ? issue.path.map(String) : ['_'])].join('.');
      errors[path] ??= issue.message;
    }
  }
  return errors;
}

const sectionOfError = (path: string) => SECTIONS.find((s) => (s.keys as readonly string[]).includes(path.split('.')[0]!));

interface Props {
  initial: SettingsValues;
  /** Nama cabang untuk pilihan "Sumber cabang" rating. */
  branchNames: string[];
}

export default function SettingsForm({ initial, branchNames }: Props) {
  const hydrated = useHydrated();
  const [baseline, setBaseline] = useState<SettingsValues>(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const heroInput = useRef<HTMLInputElement>(null);

  const values = useMemo(() => toValues(draft), [draft]);
  const baselineValues = useMemo(() => toValues(toDraft(baseline)), [baseline]);
  const dirtyKeys = (Object.keys(values) as EditableKey[]).filter(
    (key) => !sameValue(values[key], baselineValues[key]),
  );
  const clientErrors = validate(values, dirtyKeys);
  const errors = { ...serverErrors, ...clientErrors };
  const errorPaths = Object.keys(errors);
  const dirty = dirtyKeys.length > 0;

  // Peringatan bila meninggalkan halaman dengan perubahan yang belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setServerErrors({});
  };
  const err = (path: string) => errors[path];

  async function save() {
    if (errorPaths.length > 0) {
      const first = sectionOfError(errorPaths[0]!);
      if (first) document.getElementById(first.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast({
        kind: 'error',
        title: `${errorPaths.length} isian perlu diperbaiki`,
        message: 'Perbaiki isian yang bertanda merah, lalu simpan lagi.',
      });
      return;
    }
    setSaving(true);
    const results = await Promise.all(
      dirtyKeys.map(async (key) => ({
        key,
        result: await callApi<{ key: string; value: unknown }>('PUT', `/api/admin/settings/${key}`, {
          value: values[key],
        }),
      })),
    );
    setSaving(false);

    const saved: Partial<Record<EditableKey, unknown>> = {};
    const failed: string[] = [];
    const nextServerErrors: Record<string, string> = {};
    for (const { key, result } of results) {
      if (result.success) {
        saved[key] = result.data.value;
      } else {
        failed.push(key);
        const entries = Object.entries(result.error.details);
        if (entries.length === 0) nextServerErrors[`${key}._`] = result.error.message;
        for (const [path, message] of entries) nextServerErrors[`${key}.${path}`] = message;
      }
    }
    if (Object.keys(saved).length > 0) {
      const nextBaseline = { ...baseline, ...saved } as SettingsValues;
      setBaseline(nextBaseline);
      // Isi form dengan nilai yang dinormalkan server (mis. nomor WA) untuk bagian yang tersimpan.
      const savedDraft = toDraft(nextBaseline);
      setDraft((current) => {
        const next = { ...current };
        if ('hero' in saved) next.hero = savedDraft.hero;
        if ('whatsapp_number' in saved) next.phone = savedDraft.phone;
        if ('whatsapp_templates' in saved) next.whatsapp_templates = savedDraft.whatsapp_templates;
        if ('social_links' in saved) next.social_links = savedDraft.social_links;
        if ('google_rating' in saved) next.rating = savedDraft.rating;
        if ('about_highlights' in saved) next.about_highlights = savedDraft.about_highlights;
        if ('haircut_includes' in saved) next.haircut_includes = savedDraft.haircut_includes;
        if ('academy_section' in saved) next.academy_section = savedDraft.academy_section;
        if ('partnership_section' in saved) next.partnership_section = savedDraft.partnership_section;
        return next;
      });
    }
    setServerErrors(nextServerErrors);
    if (failed.length === 0) {
      showToast({
        kind: 'success',
        title: 'Pengaturan disimpan sebagai draf',
        message: 'Publikasikan agar perubahan tampil di situs.',
      });
    } else {
      showToast({
        kind: 'error',
        title: 'Sebagian pengaturan gagal disimpan',
        message: 'Periksa isian yang bertanda merah.',
      });
    }
  }

  function cancel() {
    setDraft(toDraft(baseline));
    setServerErrors({});
    showToast({ kind: 'success', title: 'Perubahan dibatalkan' });
  }

  async function replaceHero(file: File) {
    setUploading(true);
    const uploaded = await uploadImage(file, 'site');
    setUploading(false);
    if (!uploaded.ok) {
      showToast({ kind: 'error', title: 'Gagal mengunggah gambar', message: uploaded.message });
      return;
    }
    set('hero', { ...draft.hero, image_path: uploaded.image.path, image_is_placeholder: false });
  }

  // ---- potongan UI -----------------------------------------------------------------------

  const field = (id: string, label: string, input: React.ReactNode, path: string, hint?: string) => (
    <div>
      <label className="fl" htmlFor={id}>
        {label}
      </label>
      {input}
      {err(path) ? (
        <p className="ferr" id={`${id}-e`} role="alert">
          {err(path)}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );

  const inputProps = (id: string, path: string) => ({
    id,
    className: `inp${err(path) ? ' err' : ''}`,
    'aria-invalid': err(path) ? (true as const) : undefined,
    'aria-describedby': err(path) ? `${id}-e` : undefined,
  });

  const sectionHasError = (section: (typeof SECTIONS)[number]) =>
    errorPaths.some((path) => (section.keys as readonly string[]).includes(path.split('.')[0]!));

  const errorSummary = errorPaths.length
    ? `${errorPaths.length} isian perlu diperbaiki (${[...new Set(errorPaths.map((p) => sectionOfError(p)?.label ?? p))].join(', ')})`
    : null;

  return (
    <div data-hydrated={hydrated ? 'true' : 'false'} data-settings>
      <div className="page-head">
        <div>
          <h1 className="h1">Pengaturan Situs</h1>
          <p className="page-sub">
            Teks dan tautan yang dipakai di seluruh situs. Simpan sebagai draf, lalu publikasikan.
          </p>
        </div>
      </div>

      <div className="st-layout">
        <nav aria-label="Bagian pengaturan" className="st-nav">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`st-link${active === section.id ? ' on' : ''}`}
              aria-current={active === section.id ? 'true' : undefined}
              onClick={() => setActive(section.id)}
            >
              {section.label}
              {sectionHasError(section) && (
                <span className="st-dot" role="img" aria-label="ada isian bermasalah" />
              )}
            </a>
          ))}
        </nav>

        <form className="st-form" onSubmit={(event) => event.preventDefault()} noValidate>
          {/* ---------------- Hero ---------------- */}
          <section id="st-hero" className="card st-sec" aria-labelledby="h-hero">
            <div className="st-sh">
              <h2 id="h-hero" className="st-h2">
                Hero
              </h2>
              <p className="st-sub">Bagian paling atas halaman utama.</p>
            </div>
            {field(
              's-judul',
              'Judul',
              <input
                {...inputProps('s-judul', 'hero.title')}
                maxLength={120}
                value={draft.hero.title}
                onChange={(event) => set('hero', { ...draft.hero, title: event.target.value })}
              />,
              'hero.title',
              'Kalimat kedua otomatis berwarna biru aksen.',
            )}
            {field(
              's-sub',
              'Subjudul',
              <textarea
                {...inputProps('s-sub', 'hero.subtitle')}
                rows={3}
                value={draft.hero.subtitle}
                onChange={(event) => set('hero', { ...draft.hero, subtitle: event.target.value })}
              />,
              'hero.subtitle',
              `${draft.hero.subtitle.length}/160 karakter`,
            )}
            <div>
              <span className="fl">Gambar hero</span>
              <div className="st-hero-img">
                <img
                  src={mediaUrl(draft.hero.image_path)}
                  alt="Gambar hero saat ini"
                  width={200}
                  height={120}
                />
                <div className="st-hero-actions">
                  <span className="st-sub" data-hero-path>
                    {draft.hero.image_path.split('/').pop()}
                  </span>
                  <div className="st-row">
                    <button
                      type="button"
                      className="btn-o"
                      disabled={uploading}
                      onClick={() => heroInput.current?.click()}
                    >
                      {uploading ? 'Mengunggah…' : 'Ganti gambar'}
                    </button>
                    <button
                      type="button"
                      className="btn-o st-danger"
                      disabled={draft.hero.image_path === HERO_DUMMY}
                      onClick={() =>
                        set('hero', { ...draft.hero, image_path: HERO_DUMMY, image_is_placeholder: true })
                      }
                    >
                      Pakai ilustrasi bawaan
                    </button>
                  </div>
                  <label className="gal-check">
                    <input
                      type="checkbox"
                      checked={draft.hero.image_is_placeholder}
                      onChange={(event) =>
                        set('hero', { ...draft.hero, image_is_placeholder: event.target.checked })
                      }
                    />
                    <span>Foto ilustrasi/contoh (tampil dengan label &quot;Ilustrasi&quot;)</span>
                  </label>
                  <span className="st-sub">JPG/PNG/WebP · maks. 3 MB · rasio 4:5 atau 1:1</span>
                </div>
              </div>
              <input
                ref={heroInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="gal-file"
                tabIndex={-1}
                aria-hidden="true"
                data-hero-input
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void replaceHero(file);
                }}
              />
              {err('hero.image_path') && (
                <p className="ferr" role="alert">
                  {err('hero.image_path')}
                </p>
              )}
            </div>
          </section>

          {/* ---------------- Kontak ---------------- */}
          <section id="st-kontak" className="card st-sec" aria-labelledby="h-kontak">
            <div className="st-sh">
              <h2 id="h-kontak" className="st-h2">
                Kontak
              </h2>
              <p className="st-sub">Dipakai di navbar, tombol melayang, dan footer.</p>
            </div>
            <div style={{ maxWidth: 360 }}>
              <label className="fl" htmlFor="s-wa">
                Nomor WhatsApp utama
              </label>
              <div className="st-phone">
                <span className="st-pre">+62</span>
                <input
                  {...inputProps('s-wa', 'whatsapp_number._')}
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(event) => set('phone', event.target.value)}
                />
              </div>
              {err('whatsapp_number._') ? (
                <p className="ferr" id="s-wa-e" role="alert">
                  {err('whatsapp_number._')}
                </p>
              ) : (
                <p className="hint">Dipakai semua cabang yang tidak punya nomor khusus.</p>
              )}
            </div>
            <div className="st-g2">
              {field(
                's-ig',
                'Instagram',
                <input
                  {...inputProps('s-ig', 'social_links.instagram')}
                  type="url"
                  value={draft.social_links.instagram}
                  onChange={(event) => set('social_links', { ...draft.social_links, instagram: event.target.value })}
                />,
                'social_links.instagram',
              )}
              {field(
                's-th',
                'Threads',
                <input
                  {...inputProps('s-th', 'social_links.threads')}
                  type="url"
                  value={draft.social_links.threads}
                  onChange={(event) => set('social_links', { ...draft.social_links, threads: event.target.value })}
                />,
                'social_links.threads',
              )}
              {field(
                's-lt',
                'Linktree (opsional)',
                <input
                  {...inputProps('s-lt', 'social_links.linktree')}
                  type="url"
                  value={draft.social_links.linktree}
                  onChange={(event) => set('social_links', { ...draft.social_links, linktree: event.target.value })}
                />,
                'social_links.linktree',
              )}
              {field(
                's-ac',
                'Instagram Golden Academy',
                <input
                  {...inputProps('s-ac', 'social_links.academy_instagram')}
                  type="url"
                  value={draft.social_links.academy_instagram}
                  onChange={(event) =>
                    set('social_links', { ...draft.social_links, academy_instagram: event.target.value })
                  }
                />,
                'social_links.academy_instagram',
              )}
            </div>
          </section>

          {/* ---------------- Template WA ---------------- */}
          <section id="st-wa" className="card st-sec" aria-labelledby="h-wa">
            <div className="st-sh">
              <h2 id="h-wa" className="st-h2">
                Template Pesan WhatsApp
              </h2>
              <p className="st-sub">
                Teks yang otomatis terisi saat pengunjung menekan tombol booking. Klik chip untuk
                menyisipkan data.
              </p>
            </div>
            {TEMPLATE_META.map((meta) => (
              <TemplateEditor
                key={meta.key}
                meta={meta}
                value={draft.whatsapp_templates[meta.key]}
                error={err(`whatsapp_templates.${meta.key}`)}
                onChange={(text) =>
                  set('whatsapp_templates', { ...draft.whatsapp_templates, [meta.key]: text })
                }
              />
            ))}
          </section>

          {/* ---------------- Rating ---------------- */}
          <section id="st-rating" className="card st-sec" aria-labelledby="h-rt">
            <div className="st-sh">
              <h2 id="h-rt" className="st-h2">
                Rating Google
              </h2>
              <p className="st-sub">
                Ditampilkan di hero dan blok &quot;Kenapa Golden?&quot;. Perbarui manual dari Google Maps.
              </p>
            </div>
            <div className="st-g3">
              {field(
                's-rv',
                'Nilai rating',
                <input
                  {...inputProps('s-rv', 'google_rating.rating')}
                  inputMode="decimal"
                  value={draft.rating.rating}
                  onChange={(event) => set('rating', { ...draft.rating, rating: event.target.value })}
                />,
                'google_rating.rating',
                'Skala 1–5, satu angka desimal.',
              )}
              {field(
                's-rn',
                'Jumlah ulasan',
                <input
                  {...inputProps('s-rn', 'google_rating.review_count')}
                  inputMode="numeric"
                  value={draft.rating.review_count}
                  onChange={(event) => set('rating', { ...draft.rating, review_count: event.target.value })}
                />,
                'google_rating.review_count',
                `Tampil sebagai "${(parseCount(draft.rating.review_count) || 0).toLocaleString('id-ID')}+ ulasan".`,
              )}
              {field(
                's-rd',
                'Data per tanggal',
                <input
                  {...inputProps('s-rd', 'google_rating.updated_at')}
                  type="date"
                  value={draft.rating.updated_at}
                  onChange={(event) => set('rating', { ...draft.rating, updated_at: event.target.value })}
                />,
                'google_rating.updated_at',
              )}
            </div>
            <div style={{ maxWidth: 360 }}>
              {field(
                's-rc',
                'Sumber cabang',
                <select
                  {...inputProps('s-rc', 'google_rating.scope')}
                  className="sel"
                  value={draft.rating.scope}
                  onChange={(event) => set('rating', { ...draft.rating, scope: event.target.value })}
                >
                  {[...branchNames.map((name) => `Cabang ${name}`), 'Semua cabang (gabungan)']
                    .concat(
                      !branchNames.some((name) => `Cabang ${name}` === draft.rating.scope) &&
                        draft.rating.scope !== 'Semua cabang (gabungan)'
                        ? [draft.rating.scope]
                        : [],
                    )
                    .map((scope) => (
                      <option key={scope} value={scope}>
                        {scope}
                      </option>
                    ))}
                </select>,
                'google_rating.scope',
              )}
            </div>
          </section>

          {/* ---------------- Teks ---------------- */}
          <section id="st-teks" className="card st-sec" aria-labelledby="h-tx">
            <div className="st-sh">
              <h2 id="h-tx" className="st-h2">
                Teks Academy &amp; Kemitraan
              </h2>
            </div>
            <div className="st-g2">
              <div className="st-col">
                <p className="lbl st-lbl">Golden Academy</p>
                {field(
                  's-aj',
                  'Judul',
                  <input
                    {...inputProps('s-aj', 'academy_section.title')}
                    value={draft.academy_section.title}
                    onChange={(event) => set('academy_section', { ...draft.academy_section, title: event.target.value })}
                  />,
                  'academy_section.title',
                )}
                {field(
                  's-ad',
                  'Deskripsi',
                  <textarea
                    {...inputProps('s-ad', 'academy_section.description')}
                    rows={6}
                    value={draft.academy_section.description}
                    onChange={(event) =>
                      set('academy_section', { ...draft.academy_section, description: event.target.value })
                    }
                  />,
                  'academy_section.description',
                  `${draft.academy_section.description.length}/500 karakter`,
                )}
                <label className="gal-check">
                  <input
                    type="checkbox"
                    checked={draft.academy_section.is_details_available}
                    onChange={(event) =>
                      set('academy_section', { ...draft.academy_section, is_details_available: event.target.checked })
                    }
                  />
                  <span>Detail kelas (jadwal, biaya) sudah siap diumumkan</span>
                </label>
              </div>
              <div className="st-col">
                <p className="lbl st-lbl">Kemitraan</p>
                {field(
                  's-kj',
                  'Judul',
                  <input
                    {...inputProps('s-kj', 'partnership_section.title')}
                    value={draft.partnership_section.title}
                    onChange={(event) =>
                      set('partnership_section', { ...draft.partnership_section, title: event.target.value })
                    }
                  />,
                  'partnership_section.title',
                )}
                {field(
                  's-kd',
                  'Narasi',
                  <textarea
                    {...inputProps('s-kd', 'partnership_section.description')}
                    rows={6}
                    value={draft.partnership_section.description}
                    onChange={(event) =>
                      set('partnership_section', { ...draft.partnership_section, description: event.target.value })
                    }
                  />,
                  'partnership_section.description',
                  `${draft.partnership_section.description.length}/500 karakter`,
                )}
              </div>
            </div>
          </section>

          {/* ---------------- Keunggulan & Termasuk ---------------- */}
          <section id="st-poin" className="card st-sec" aria-labelledby="h-poin">
            <div className="st-sh">
              <h2 id="h-poin" className="st-h2">
                Keunggulan &amp; Termasuk
              </h2>
              <p className="st-sub">
                Poin &quot;Kenapa Golden?&quot; di halaman utama dan daftar &quot;Sudah termasuk&quot; pada harga haircut.
              </p>
            </div>

            <fieldset className="st-fieldset">
              <legend className="fl">Poin keunggulan ({draft.about_highlights.length}/8)</legend>
              {err('about_highlights._') && (
                <p className="ferr" role="alert">
                  {err('about_highlights._')}
                </p>
              )}
              {draft.about_highlights.map((item, index) => (
                <div key={index} className="st-item" data-highlight={index}>
                  <div className="st-item-grid">
                    <div>
                      <label className="fl" htmlFor={`hl-icon-${index}`}>
                        Ikon
                      </label>
                      <select
                        id={`hl-icon-${index}`}
                        className="sel"
                        value={item.icon}
                        onChange={(event) => updateHighlight(index, { icon: event.target.value })}
                      >
                        {HIGHLIGHT_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {ICON_LABEL[icon] ?? icon}
                          </option>
                        ))}
                      </select>
                    </div>
                    {field(
                      `hl-title-${index}`,
                      'Judul',
                      <input
                        {...inputProps(`hl-title-${index}`, `about_highlights.${index}.title`)}
                        maxLength={40}
                        value={item.title}
                        onChange={(event) => updateHighlight(index, { title: event.target.value })}
                      />,
                      `about_highlights.${index}.title`,
                    )}
                  </div>
                  {field(
                    `hl-desc-${index}`,
                    'Deskripsi',
                    <textarea
                      {...inputProps(`hl-desc-${index}`, `about_highlights.${index}.description`)}
                      rows={2}
                      maxLength={160}
                      value={item.description}
                      onChange={(event) => updateHighlight(index, { description: event.target.value })}
                    />,
                    `about_highlights.${index}.description`,
                  )}
                  <ItemTools
                    label={`poin ${item.title || index + 1}`}
                    index={index}
                    count={draft.about_highlights.length}
                    onMove={(to) => set('about_highlights', move(draft.about_highlights, index, to))}
                    onRemove={() =>
                      set('about_highlights', draft.about_highlights.filter((_, i) => i !== index))
                    }
                    removeDisabled={draft.about_highlights.length <= 1}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn-o"
                disabled={draft.about_highlights.length >= 8}
                onClick={() =>
                  set('about_highlights', [
                    ...draft.about_highlights,
                    { icon: 'star', title: '', description: '' },
                  ])
                }
              >
                <Icon name="plus" size={16} /> Tambah poin
              </button>
            </fieldset>

            <fieldset className="st-fieldset">
              <legend className="fl">Sudah termasuk dalam harga haircut ({draft.haircut_includes.length}/8)</legend>
              {err('haircut_includes._') && (
                <p className="ferr" role="alert">
                  {err('haircut_includes._')}
                </p>
              )}
              {draft.haircut_includes.map((text, index) => (
                <div key={index} className="st-item" data-include={index}>
                  {field(
                    `inc-${index}`,
                    `Item ${index + 1}`,
                    <input
                      {...inputProps(`inc-${index}`, `haircut_includes.${index}`)}
                      maxLength={60}
                      value={text}
                      onChange={(event) =>
                        set(
                          'haircut_includes',
                          draft.haircut_includes.map((row, i) => (i === index ? event.target.value : row)),
                        )
                      }
                    />,
                    `haircut_includes.${index}`,
                  )}
                  <ItemTools
                    label={`item ${text || index + 1}`}
                    index={index}
                    count={draft.haircut_includes.length}
                    onMove={(to) => set('haircut_includes', move(draft.haircut_includes, index, to))}
                    onRemove={() =>
                      set('haircut_includes', draft.haircut_includes.filter((_, i) => i !== index))
                    }
                    removeDisabled={draft.haircut_includes.length <= 1}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn-o"
                disabled={draft.haircut_includes.length >= 8}
                onClick={() => set('haircut_includes', [...draft.haircut_includes, ''])}
              >
                <Icon name="plus" size={16} /> Tambah item
              </button>
            </fieldset>
          </section>
        </form>
      </div>

      <div className="st-bar" data-settings-bar>
        {errorSummary ? (
          <span role="alert" className="st-bar-err">
            <Icon name="alert-circle" size={16} />
            {errorSummary}
          </span>
        ) : (
          <span className="st-bar-info" role="status">
            {dirty ? `${dirtyKeys.length} bagian berubah` : 'Tidak ada perubahan'}
          </span>
        )}
        <span className="st-bar-note">· Perubahan disimpan sebagai draf sampai dipublikasikan.</span>
        <div className="st-bar-actions">
          <button type="button" className="btn-o" disabled={!dirty || saving} onClick={cancel}>
            Batalkan Perubahan
          </button>
          <button type="button" className="btn" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Menyimpan…' : 'Simpan Draf'}
          </button>
        </div>
      </div>
    </div>
  );

  function updateHighlight(index: number, change: Partial<Highlight>) {
    set(
      'about_highlights',
      draft.about_highlights.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );
  }
}

// ---------------------------------------------------------------------------------------------

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function ItemTools({
  label,
  index,
  count,
  onMove,
  onRemove,
  removeDisabled,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  return (
    <div className="st-tools">
      <button
        type="button"
        className="ib"
        aria-label={`Naikkan ${label}`}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <Icon name="arrow-up" size={17} />
      </button>
      <button
        type="button"
        className="ib"
        aria-label={`Turunkan ${label}`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <Icon name="arrow-down" size={17} />
      </button>
      <button
        type="button"
        className="ib dng"
        aria-label={`Hapus ${label}`}
        disabled={removeDisabled}
        onClick={onRemove}
      >
        <Icon name="trash" size={17} />
      </button>
    </div>
  );
}

function TemplateEditor({
  meta,
  value,
  error,
  onChange,
}: {
  meta: { key: WhatsAppTemplateKey; title: string; where: string };
  value: string;
  error: string | undefined;
  onChange: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = `tpl-${meta.key}`;
  const chips = placeholdersFor(meta.key);

  function insert(placeholder: string) {
    const area = ref.current;
    const { text, cursor } = insertPlaceholder(
      value,
      placeholder,
      area?.selectionStart ?? value.length,
      area?.selectionEnd ?? value.length,
    );
    onChange(text);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="st-tpl" data-template={meta.key}>
      <div>
        <label className="fl" htmlFor={id}>
          {meta.title}
        </label>
        <p className="hint st-tpl-where">{meta.where}</p>
      </div>
      <div className="st-tpl-body">
        <textarea
          ref={ref}
          id={id}
          className={`inp${error ? ' err' : ''}`}
          style={{ minHeight: 72 }}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-e` : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {error && (
          <p className="ferr" id={`${id}-e`} role="alert">
            {error}
          </p>
        )}
        <div className="st-chips">
          {chips.length === 0 ? (
            <span className="st-sub">Template ini tidak memakai placeholder.</span>
          ) : (
            <>
              <span className="st-sub">Sisipkan:</span>
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="st-chip"
                  aria-label={`Sisipkan {${chip}} ke ${meta.title}`}
                  onClick={() => insert(chip)}
                >
                  {`{${chip}}`}
                </button>
              ))}
            </>
          )}
        </div>
        <p className="st-prev" data-preview={meta.key}>
          <span className="lbl st-prev-lbl">Pratinjau</span>
          {previewTemplate(value)}
        </p>
      </div>
    </div>
  );
}
