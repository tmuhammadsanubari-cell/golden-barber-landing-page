// FAQ admin (PRD F-21; tanpa mockup, pola daftar seperti Galeri/Testimoni). FAQ yang jawabannya
// masih "MENUNGGU KONFIRMASI PEMILIK" (seed, PRD Lampiran B) tidak bisa ditampilkan sampai
// jawaban final diisi.
import { useState } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormDialog from '@/components/admin/FormDialog';
import Icon from '@/components/ui/Icon';
import { callApi } from '@/lib/admin/client';
import { countSummary, pendingFaqCount, truncate } from '@/lib/admin/content-view';
import { showToast } from '@/lib/admin/toast';
import { useHydrated } from '@/lib/admin/use-hydrated';
import { useSortable } from '@/lib/admin/use-sortable';
import { faqCreateSchema, isPendingAnswer } from '@/lib/validation/admin-faqs';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
}

type Dialog = { kind: 'form'; id: string | null } | { kind: 'delete'; id: string } | null;

export default function FaqManager({ initial }: { initial: FaqItem[] }) {
  const hydrated = useHydrated();
  const [items, setItems] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const sortable = useSortable({
    items,
    setItems,
    endpoint: '/api/admin/faqs/reorder',
    label: (item) => item.question,
  });

  const target = dialog ? (items.find((item) => item.id === dialog.id) ?? null) : null;
  const pending = pendingFaqCount(items);

  async function toggleActive(item: FaqItem) {
    const result = await callApi<FaqItem>('PATCH', `/api/admin/faqs/${item.id}`, {
      is_active: !item.is_active,
    });
    if (!result.success) {
      showToast({
        kind: 'error',
        title: 'Gagal mengubah tampilan',
        message: result.error.details.answer ?? result.error.message,
        action: { label: 'Isi jawaban', onClick: () => setDialog({ kind: 'form', id: item.id }) },
      });
      return;
    }
    setItems((current) => current.map((row) => (row.id === item.id ? result.data : row)));
    showToast({
      kind: 'success',
      title: item.is_active ? 'FAQ disembunyikan' : 'FAQ ditampilkan',
    });
  }

  async function remove(item: FaqItem) {
    setBusy(true);
    const result = await callApi('DELETE', `/api/admin/faqs/${item.id}`);
    setBusy(false);
    setDialog(null);
    if (!result.success) {
      showToast({ kind: 'error', title: 'Gagal menghapus', message: result.error.message });
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    showToast({ kind: 'success', title: 'FAQ dihapus' });
  }

  return (
    <div data-hydrated={hydrated ? 'true' : 'false'} data-faqs>
      <div className="page-head">
        <div>
          <h1 className="h1">FAQ</h1>
          <p className="page-sub" data-count-summary>
            {countSummary('FAQ', items)}. Seret ⋮⋮ untuk mengatur urutan di situs.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setDialog({ kind: 'form', id: null })}>
          <Icon name="plus" size={18} />
          Tambah FAQ
        </button>
      </div>

      {pending > 0 && (
        <p className="gal-note" role="status" data-pending-note>
          {pending} FAQ belum punya jawaban final (menunggu konfirmasi pemilik) dan tidak bisa
          ditampilkan di situs. Isi jawabannya lewat tombol Edit.
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {sortable.announce}
      </p>

      {items.length === 0 ? (
        <div className="card empty-state" data-empty>
          <p>Belum ada FAQ. Tambahkan pertanyaan yang sering diajukan calon pelanggan.</p>
        </div>
      ) : (
        <ul className="crud-list" aria-label="Daftar FAQ">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`card crud-row ${item.is_active ? '' : 'off'} ${sortable.rowClass(item.id)}`}
              data-row-id={item.id}
              {...sortable.rowProps(item.id, index)}
            >
              <button
                type="button"
                className="ib grip crud-grip"
                aria-label={`Atur urutan FAQ ${item.question}, urutan ${index + 1} dari ${items.length}. Seret, atau tekan panah atas/bawah.`}
                onKeyDown={(event) => sortable.onHandleKey(event, item.id, index)}
              >
                <Icon name="grip" size={16} />
              </button>
              <div className="crud-main">
                <p className="crud-title">
                  <strong>{item.question}</strong>
                  {isPendingAnswer(item.answer) && (
                    <span className="bd b-warn">Menunggu jawaban</span>
                  )}
                </p>
                <p className="crud-text">
                  {isPendingAnswer(item.answer) ? 'Jawaban belum diisi.' : truncate(item.answer, 200)}
                </p>
              </div>
              <div className="crud-side">
                <span className="crud-switch">
                  <button
                    type="button"
                    className={`sw${item.is_active ? ' on' : ''}`}
                    role="switch"
                    aria-checked={item.is_active}
                    aria-label={`Tampilkan FAQ ${item.question} di situs`}
                    onClick={() => void toggleActive(item)}
                  />
                  <span className={`gal-state${item.is_active ? ' on' : ''}`}>
                    {item.is_active ? 'Tampil' : 'Disembunyikan'}
                  </span>
                </span>
                <span className="crud-actions">
                  <button
                    type="button"
                    className="ib only-sm-flex"
                    aria-label={`Naikkan ${item.question}`}
                    disabled={index === 0}
                    onClick={() => sortable.move(item.id, index - 1)}
                  >
                    <Icon name="arrow-up" size={17} />
                  </button>
                  <button
                    type="button"
                    className="ib only-sm-flex"
                    aria-label={`Turunkan ${item.question}`}
                    disabled={index === items.length - 1}
                    onClick={() => sortable.move(item.id, index + 1)}
                  >
                    <Icon name="arrow-down" size={17} />
                  </button>
                  <button
                    type="button"
                    className="ib"
                    aria-label={`Edit FAQ ${item.question}`}
                    onClick={() => setDialog({ kind: 'form', id: item.id })}
                  >
                    <Icon name="edit" size={17} />
                  </button>
                  <button
                    type="button"
                    className="ib dng"
                    aria-label={`Hapus FAQ ${item.question}`}
                    onClick={() => setDialog({ kind: 'delete', id: item.id })}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FaqDialog
        key={dialog?.kind === 'form' ? `form-${dialog.id ?? 'baru'}` : 'closed'}
        open={dialog?.kind === 'form'}
        item={dialog?.kind === 'form' ? target : null}
        onClose={() => setDialog(null)}
        onSaved={(saved, created) => {
          setItems((current) =>
            created ? [...current, saved] : current.map((row) => (row.id === saved.id ? saved : row)),
          );
          setDialog(null);
          showToast({ kind: 'success', title: created ? 'FAQ ditambahkan' : 'FAQ disimpan' });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete' && target !== null}
        title="Hapus FAQ ini?"
        description={`"${target?.question ?? ''}" dihapus permanen dan tidak dapat dibatalkan. Jika hanya tidak ingin ditampilkan, sembunyikan saja.`}
        confirmLabel="Hapus"
        secondary={
          target?.is_active
            ? {
                label: 'Sembunyikan saja',
                onClick: () => {
                  const item = target;
                  setDialog(null);
                  void toggleActive(item);
                },
              }
            : undefined
        }
        busy={busy}
        onConfirm={() => target && void remove(target)}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function FaqDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: FaqItem | null;
  onClose: () => void;
  onSaved: (item: FaqItem, created: boolean) => void;
}) {
  // Jawaban penanda (seed) dikosongkan di form supaya admin menulis jawaban final.
  const [question, setQuestion] = useState(item?.question ?? '');
  const [answer, setAnswer] = useState(item && !isPendingAnswer(item.answer) ? item.answer : '');
  const [active, setActive] = useState(item ? item.is_active : true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = faqCreateSchema.safeParse({ question, answer, is_active: active });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    const result = item
      ? await callApi<FaqItem>('PUT', `/api/admin/faqs/${item.id}`, parsed.data)
      : await callApi<FaqItem>('POST', '/api/admin/faqs', parsed.data);
    setBusy(false);
    if (!result.success) {
      setErrors({ ...result.error.details, _: result.error.message });
      return;
    }
    onSaved(result.data, !item);
  }

  return (
    <FormDialog
      open={open}
      icon="info"
      title={item ? 'Edit FAQ' : 'Tambah FAQ'}
      description="FAQ tampil di situs hanya bila aktif dan jawabannya sudah final."
      submitLabel={item ? 'Simpan Perubahan' : 'Simpan FAQ'}
      busy={busy}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div>
        <label className="fl" htmlFor="faq-question">
          Pertanyaan
        </label>
        <input
          id="faq-question"
          className={`inp${errors.question ? ' err' : ''}`}
          maxLength={200}
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setErrors((current) => ({ ...current, question: '' }));
          }}
        />
        {errors.question && (
          <p className="ferr" role="alert">
            {errors.question}
          </p>
        )}
      </div>
      <div>
        <label className="fl" htmlFor="faq-answer">
          Jawaban
        </label>
        <textarea
          id="faq-answer"
          className={`inp${errors.answer ? ' err' : ''}`}
          rows={5}
          maxLength={1000}
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setErrors((current) => ({ ...current, answer: '' }));
          }}
        />
        {errors.answer ? (
          <p className="ferr" role="alert">
            {errors.answer}
          </p>
        ) : (
          <p className="hint">{answer.length}/1000 karakter</p>
        )}
      </div>
      <label className="gal-check">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => {
            setActive(event.target.checked);
            setErrors((current) => ({ ...current, answer: '' }));
          }}
        />
        <span>Tampilkan di situs</span>
      </label>
      {errors._ && !errors.answer && (
        <p className="ferr" role="alert">
          {errors._}
        </p>
      )}
    </FormDialog>
  );
}
