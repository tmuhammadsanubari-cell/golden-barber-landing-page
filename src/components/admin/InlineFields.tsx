// Isian inline untuk tabel Barber & Harga (PRD F-17): simpan saat kehilangan fokus atau Enter,
// dengan indikator "Tersimpan". Dua tampilan: `cell` (desktop: teks yang diklik jadi input) dan
// `field` (mobile: input selalu terlihat).
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { parsePriceCell, priceAria, priceEditText, priceText } from '@/lib/admin/barbers';

/** Hasil penyimpanan dari pemanggil: `null` = sukses, string = pesan galat untuk ditampilkan. */
export type CommitResult = Promise<string | null>;

export function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ok" role="status">
      <Icon name="check" size={12} strokeWidth={2.6} />
      Tersimpan
    </span>
  );
}

interface PriceProps {
  /** id unik elemen input (desktop dan mobile dirender bersamaan, jadi harus berbeda). */
  id: string;
  label: string;
  barberName: string;
  value: number | null;
  required: boolean;
  strike: boolean;
  variant: 'cell' | 'field';
  saved: boolean;
  error: string | null;
  onCommit: (value: number | null) => CommitResult;
}

export function PriceField({
  id,
  label,
  barberName,
  value,
  required,
  strike,
  variant,
  saved,
  error,
  onCommit,
}: PriceProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(priceEditText(value));
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const shown = localError ?? error;

  // Sinkronkan draf bila nilai berubah dari luar (mis. Salin harga) saat tidak sedang diketik.
  useEffect(() => {
    if (!editing) setDraft(priceEditText(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (busy.current) return;
    const parsed = parsePriceCell(draft);
    if (parsed === undefined) {
      setLocalError('Harga tidak valid. Contoh: 130K atau 130.000.');
      return;
    }
    if (parsed === null && required) {
      setLocalError('Harga Haircut Reguler wajib diisi.');
      return;
    }
    if (parsed === value) {
      setLocalError(null);
      setEditing(false);
      return;
    }
    busy.current = true;
    const message = await onCommit(parsed);
    busy.current = false;
    if (message === null) {
      setLocalError(null);
      setEditing(false);
    } else {
      setLocalError(message);
    }
  }

  function cancel() {
    setDraft(priceEditText(value));
    setLocalError(null);
    setEditing(false);
  }

  const ariaLabel = `${label} ${barberName}`;
  const errorId = `${id}-e`;

  const input = (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        className={`${variant === 'cell' ? 'cin' : 'pin'}${strike && value !== null ? ' strk' : ''}${shown ? ' err' : ''}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={variant === 'field' ? '—' : undefined}
        aria-label={variant === 'cell' ? ariaLabel : undefined}
        aria-invalid={shown ? true : undefined}
        aria-describedby={shown ? errorId : undefined}
        value={draft}
        onFocus={() => variant === 'field' && setEditing(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          if (localError) setLocalError(null);
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            // Jangan blur() manual: handler blur akan menyimpan ulang draf lama yang baru dibatalkan.
            cancel();
          }
        }}
      />
      <span aria-hidden="true" className="k-suffix">
        K
      </span>
    </div>
  );

  const errorEl = shown ? (
    <p className="ferr cell-err" id={errorId} role="alert">
      {shown}
    </p>
  ) : null;

  if (variant === 'field') {
    return (
      <div>
        <div className="field-head">
          <label className="lbl" htmlFor={id}>
            {label}
          </label>
          <SavedBadge show={saved && !shown} />
        </div>
        {input}
        {errorEl}
      </div>
    );
  }

  return (
    <div role="cell" className="r price-cell">
      {editing || shown ? (
        input
      ) : (
        <button
          type="button"
          id={id}
          className={`cell${value === null ? ' mut' : strike ? ' strk' : ''}`}
          aria-label={`Ubah ${priceAria(label, barberName, value)}`}
          onClick={() => setEditing(true)}
        >
          {priceText(value)}
        </button>
      )}
      {!editing && !shown && <SavedBadge show={saved} />}
      {errorEl}
    </div>
  );
}

interface TextProps {
  id: string;
  value: string;
  placeholder: string;
  ariaLabel: string;
  maxLength: number;
  required?: boolean;
  bold?: boolean;
  saved: boolean;
  error: string | null;
  onCommit: (value: string) => CommitResult;
}

/** Nama/label barber: teks yang diklik jadi input. */
export function InlineText({
  id,
  value,
  placeholder,
  ariaLabel,
  maxLength,
  required = false,
  bold = false,
  saved,
  error,
  onCommit,
}: TextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const shown = localError ?? error;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (busy.current) return;
    const next = draft.trim();
    if (next === '' && required) {
      setLocalError('Nama barber wajib diisi.');
      return;
    }
    if (next === value) {
      setLocalError(null);
      setEditing(false);
      return;
    }
    busy.current = true;
    const message = await onCommit(next);
    busy.current = false;
    if (message === null) {
      setLocalError(null);
      setEditing(false);
    } else {
      setLocalError(message);
    }
  }

  if (!editing && !shown) {
    return (
      <span className="text-cell">
        <button
          type="button"
          id={id}
          className={`cell cell-text${bold ? ' cell-bold' : ''}${value === '' ? ' mut' : ''}`}
          aria-label={`Ubah ${ariaLabel}`}
          onClick={() => setEditing(true)}
        >
          {value === '' ? placeholder : value}
        </button>
        <SavedBadge show={saved} />
      </span>
    );
  }
  return (
    <span className="text-cell">
      <input
        ref={inputRef}
        id={id}
        className={`cin cin-text${shown ? ' err' : ''}`}
        type="text"
        maxLength={maxLength}
        aria-label={ariaLabel}
        aria-invalid={shown ? true : undefined}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (localError) setLocalError(null);
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
            setLocalError(null);
            setEditing(false);
          }
        }}
      />
      {shown && (
        <p className="ferr cell-err" role="alert">
          {shown}
        </p>
      )}
    </span>
  );
}
