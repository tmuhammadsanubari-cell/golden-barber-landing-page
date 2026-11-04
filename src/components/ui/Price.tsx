import { formatPriceShort, formatRupiah } from '@/lib/format';

interface Props {
  value: number;
  /** Harga sebelum diskon; tampil dicoret di atas harga aktif. */
  original?: number | null;
  className?: string;
  originalClassName?: string;
}

/** Tampil "130K", dibaca pembaca layar "Rp130.000". */
export default function Price({ value, original, className = '', originalClassName = '' }: Props) {
  const current = (
    <span className={`num ${className}`} aria-label={formatRupiah(value)}>
      {formatPriceShort(value)}
    </span>
  );
  if (!original) return current;
  return (
    <span className="flex flex-col items-end leading-[1.15]">
      <s className={`num text-strike ${originalClassName}`}>
        <span className="sr-only">Harga normal </span>
        <span aria-label={formatRupiah(original)}>{formatPriceShort(original)}</span>
      </s>
      {current}
    </span>
  );
}
