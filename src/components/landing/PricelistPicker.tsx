// Island pricelist (F-03) + status layanan (F-05). Dua root React, satu store cabang terpilih.
import { useStore } from '@nanostores/react';
import { useEffect, useState, type ReactNode } from 'react';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import Price from '@/components/ui/Price';
import { formatPriceRange, formatPriceShort, formatRupiah } from '@/lib/format';
import { initSelectedBranchFromUrl, selectBranch, selectedBranch } from '@/lib/stores';
import { whatsAppLinkProps } from '@/lib/whatsapp';
import type {
  Barber,
  Branch,
  Service,
  ServiceCategory,
  ServiceStatus,
  WhatsAppSettings,
} from '@/types/content';

export type PickerBranch = Pick<Branch, 'slug' | 'name' | 'whatsapp_number' | 'is_flagship'>;
export type PickerBarber = Pick<
  Barber,
  'branch_slug' | 'name' | 'is_generic' | 'haircut_price' | 'haircut_original_price' | 'long_trim_price'
>;
export type PickerService = Pick<
  Service,
  'slug' | 'name' | 'category' | 'price_type' | 'price_min' | 'price_max' | 'note'
>;
export type Availability = Record<
  string,
  Record<string, { status: ServiceStatus; min: number | null; max: number | null }>
>;

const HAIRCUT_SERVICE = 'Haircut Reguler';

/**
 * Cabang aktif. Selama hidrasi selalu cabang default agar cocok dengan HTML statis;
 * pilihan dari store/`?cabang=` baru dipakai setelah mount.
 */
function useActiveBranch(branches: PickerBranch[]): PickerBranch {
  const stored = useStore(selectedBranch);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    initSelectedBranchFromUrl();
    setMounted(true);
  }, []);
  const fallback = branches.find((branch) => branch.is_flagship) ?? branches[0]!;
  if (!mounted || !stored) return fallback;
  return branches.find((branch) => branch.slug === stored) ?? fallback;
}

function rangeLabel(barbers: PickerBarber[]): string {
  if (barbers.length === 0) return 'Segera hadir';
  const prices = barbers.map((barber) => barber.haircut_price);
  return formatPriceRange(Math.min(...prices), Math.max(...prices));
}

interface RowProps {
  barber: PickerBarber;
  branch: PickerBranch;
  settings: WhatsAppSettings;
}

function barberLink({ barber, branch, settings }: RowProps) {
  return whatsAppLinkProps({
    context: 'barber',
    settings,
    branch,
    barber: barber.name,
    service: HAIRCUT_SERVICE,
    price: barber.haircut_price,
  });
}

function DesktopTable(props: {
  rows: PickerBarber[];
  branch: PickerBranch;
  settings: WhatsAppSettings;
  part: number;
}) {
  return (
    <div
      className="card overflow-hidden"
      role="table"
      aria-label={`Pricelist ${props.branch.name} bagian ${props.part}`}
    >
      <div role="row" className="row !min-h-16 !border-t-0 !bg-surface">
        <span role="columnheader" className="lbl !text-xs">
          Barber
        </span>
        <span
          role="columnheader"
          className="cat !text-[15px] !leading-[1.15] !text-accent-strong text-right"
        >
          Haircut Reguler
        </span>
        <span
          role="columnheader"
          className="cat !text-[15px] !leading-[1.15] !text-accent-strong text-right"
        >
          Long Trim
        </span>
        <span role="columnheader" className="sr-only">
          Aksi
        </span>
      </div>
      {props.rows.map((barber, index) => (
        <div role="row" className="row" key={`${barber.name}-${index}`}>
          <span role="cell" className="flex items-center gap-2 text-[17px] font-medium whitespace-nowrap">
            {barber.name}
            {barber.is_generic && (
              <span
                title="Dilayani barber yang tersedia"
                className="inline-flex items-center gap-1 text-[13px] font-normal text-accent-strong"
              >
                <Icon name="info" size={16} />
                Barber tersedia
              </span>
            )}
          </span>
          <span role="cell" className="flex justify-end">
            <Price
              value={barber.haircut_price}
              original={barber.haircut_original_price}
              className="text-[19px] font-bold"
              originalClassName="text-[13px]"
            />
          </span>
          <span role="cell" className="flex justify-end">
            <Price value={barber.long_trim_price} className="text-[19px] font-bold" />
          </span>
          <span role="cell" className="flex justify-end">
            <a
              className="btn-o btn-s"
              aria-label={`Booking ${barber.name} via WhatsApp`}
              {...barberLink({ barber, branch: props.branch, settings: props.settings })}
            >
              Booking
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}

function MobileTable(props: {
  rows: PickerBarber[];
  branch: PickerBranch;
  settings: WhatsAppSettings;
}) {
  return (
    <div className="card overflow-hidden" role="table" aria-label={`Pricelist ${props.branch.name}`}>
      <div role="row" className="pr !min-h-[52px] !border-t-0 !bg-surface">
        <span role="columnheader" className="lbl !text-[11px] !tracking-[0.14em]">
          Barber
        </span>
        {['Haircut Reguler', 'Long Trim'].map((label) => (
          <span
            role="columnheader"
            key={label}
            className="text-right font-display text-[11px] leading-[1.15] font-extrabold text-accent-strong uppercase"
          >
            {label}
          </span>
        ))}
        <span role="columnheader" className="sr-only">
          Booking
        </span>
      </div>
      {props.rows.map((barber, index) => (
        <div role="row" className="pr" key={`${barber.name}-${index}`}>
          <span
            role="cell"
            className="flex min-w-0 items-center gap-1.5 text-base font-medium"
          >
            {barber.name}
            {barber.is_generic && (
              <span title="Dilayani barber yang tersedia" className="text-accent-strong">
                <Icon name="info" size={16} />
                <span className="sr-only">Dilayani barber yang tersedia</span>
              </span>
            )}
          </span>
          <span role="cell" className="flex justify-end">
            <Price
              value={barber.haircut_price}
              original={barber.haircut_original_price}
              className="text-[17px] font-bold"
              originalClassName="text-xs"
            />
          </span>
          <span role="cell" className="flex justify-end">
            <Price value={barber.long_trim_price} className="text-[17px] font-bold" />
          </span>
          <span role="cell">
            <a
              className="ib"
              aria-label={`Booking ${barber.name} via WhatsApp`}
              {...barberLink({ barber, branch: props.branch, settings: props.settings })}
            >
              <Icon name="whatsapp" />
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}

interface PricelistProps {
  branches: PickerBranch[];
  barbers: PickerBarber[];
  includes: string[];
  settings: WhatsAppSettings;
}

export default function PricelistPicker({ branches, barbers, includes, settings }: PricelistProps) {
  const branch = useActiveBranch(branches);
  const barbersOf = (slug: string) => barbers.filter((barber) => barber.branch_slug === slug);
  const rows = barbersOf(branch.slug);
  const half = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, half), rows.slice(half)].filter((column) => column.length > 0);
  const hasGeneric = rows.some((barber) => barber.is_generic);

  return (
    <>
      <p className="lbl mb-3 hidden !text-xs lg:block">Pilih cabang</p>
      <div role="group" aria-label="Pilih cabang" className="mb-7 hidden flex-wrap gap-2 lg:flex">
        {branches.map((option) => (
          <button
            type="button"
            className="chip"
            key={option.slug}
            aria-pressed={option.slug === branch.slug}
            onClick={() => selectBranch(option.slug)}
          >
            <span className="font-bold">{option.name}</span>
            <span className="rg">· {rangeLabel(barbersOf(option.slug))}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-1.5 lg:hidden">
        <label htmlFor="pricelist-cabang" className="lbl !text-[11px]">
          Pilih cabang
        </label>
        <div className="relative">
          <select
            id="pricelist-cabang"
            className="sel"
            value={branch.slug}
            onChange={(event) => selectBranch(event.target.value)}
          >
            {branches.map((option) => (
              <option value={option.slug} key={option.slug}>
                {option.name} · {rangeLabel(barbersOf(option.slug))}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2">
            <Icon name="chevron-down" />
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3.5 !bg-white px-5 py-8 text-center lg:gap-4 lg:px-10 lg:py-14">
          <span className="hidden text-accent-strong lg:block">
            <Icon name="list" size={40} strokeWidth={1.3} />
          </span>
          <Badge variant="baru">Segera Hadir</Badge>
          <h3 className="m-0 font-display text-[21px] font-extrabold lg:text-[26px]">
            Pricelist cabang ini segera hadir
          </h3>
          <p className="body-text max-w-[460px] !text-[15px] lg:!text-[17px]">
            Kami sedang menyiapkan daftar barber dan harga untuk {branch.name}. Tanyakan harga
            terbaru langsung ke admin.
          </p>
          <a
            className="btn self-stretch lg:self-center"
            {...whatsAppLinkProps({ context: 'branch_no_pricelist', settings, branch })}
          >
            Tanya Harga via WhatsApp
          </a>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-1.5 rounded-gb border border-line bg-white px-4 py-3.5 lg:mb-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4 lg:px-5 lg:py-4">
            <span className="lbl !text-[11px] !font-medium !text-accent-strong lg:!text-[13px]">
              Sudah termasuk
            </span>
            <span aria-hidden="true" className="hidden h-5 w-px bg-line lg:block" />
            <span className="text-[15px] leading-[1.55] lg:text-base">
              {includes.map((item, index) => (
                <span key={item}>
                  {index > 0 && <span className="text-sep"> · </span>}
                  {item}
                </span>
              ))}
            </span>
          </div>

          <div className="hidden grid-cols-2 items-start gap-5 xl:grid">
            {columns.map((column, index) => (
              <DesktopTable
                key={index}
                rows={column}
                branch={branch}
                settings={settings}
                part={index + 1}
              />
            ))}
          </div>
          <div className="xl:hidden">
            <MobileTable rows={rows} branch={branch} settings={settings} />
          </div>

          <div className="mt-4 flex flex-col gap-1.5 text-[13px] leading-normal text-ink-muted lg:flex-row lg:flex-wrap lg:gap-6 lg:text-sm">
            <p className="order-last m-0 lg:order-none">
              Harga dalam ribuan rupiah (130K = Rp130.000).
              <span className="lg:hidden"> Ikon WA = booking barber tsb.</span>
            </p>
            {hasGeneric && (
              <p className="m-0 flex items-start gap-1.5">
                <span className="text-accent-strong">
                  <Icon name="info" size={16} />
                </span>
                <span>
                  <strong className="text-ink">By Barber</strong>: dilayani barber yang tersedia.
                </span>
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

const GROUPS: { category: ServiceCategory; title: string; sub: string }[] = [
  { category: 'add_on', title: 'Add-ons', sub: 'Tambahan haircut' },
  { category: 'hair_colouring', title: 'Hair Colouring', sub: 'Pewarnaan rambut' },
  { category: 'hair_treatment', title: 'Hair Treatment', sub: 'Perawatan & styling' },
];

function ServicePrice(props: { type: Service['price_type']; min: number; max: number | null }) {
  const { type, min, max } = props;
  if (type === 'range') {
    return (
      <span
        className="num font-bold"
        aria-label={`${formatRupiah(min)} sampai ${formatRupiah(max ?? min)}`}
      >
        {formatPriceRange(min, max)}
      </span>
    );
  }
  return (
    <span className="num font-bold">
      {type === 'start_from' && (
        <span className="mr-1 text-[13px] font-normal text-ink-muted">Mulai</span>
      )}
      <span aria-label={formatRupiah(min)}>{formatPriceShort(min)}</span>
    </span>
  );
}

interface ServicesProps {
  branches: PickerBranch[];
  services: PickerService[];
  availability: Availability;
  settings: WhatsAppSettings;
  /** Judul section (dari SectionHeading.astro), sebaris dengan pemilih cabang di desktop. */
  children?: ReactNode;
}

export function ServicesPanel({ branches, services, availability, settings, children }: ServicesProps) {
  const branch = useActiveBranch(branches);
  const statusOf = availability[branch.slug] ?? {};

  const groups = GROUPS.map((group) => ({
    ...group,
    items: services
      .filter((service) => service.category === group.category)
      .map((service) => ({ service, entry: statusOf[service.slug] }))
      .filter(({ entry }) => entry && entry.status !== 'unavailable'),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <div className="mb-4 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        {children}
        <div className="hidden min-w-[300px] flex-col gap-1.5 lg:flex">
          <label htmlFor="layanan-cabang" className="lbl !text-xs">
            Ketersediaan di cabang
          </label>
          <select
            id="layanan-cabang"
            className="inp font-bold"
            value={branch.slug}
            onChange={(event) => selectBranch(event.target.value)}
          >
            {branches.map((option) => (
              <option value={option.slug} key={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <p className="m-0 text-sm text-ink-muted lg:hidden">
          Ketersediaan di cabang <strong className="text-ink">{branch.name}</strong> ·{' '}
          <a href="#harga" className="inline-flex min-h-11 items-center underline">
            Ganti cabang
          </a>
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="card flex flex-col items-center gap-3.5 !bg-white px-5 py-8 text-center lg:px-10 lg:py-14">
          <h3 className="m-0 font-display text-[21px] font-extrabold lg:text-[26px]">
            Layanan cabang ini segera hadir
          </h3>
          <a
            className="btn self-stretch lg:self-center"
            {...whatsAppLinkProps({ context: 'branch_no_pricelist', settings, branch })}
          >
            Tanya via WhatsApp
          </a>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-5">
          {groups.map((group) => (
            <div className="card px-5 pt-5 pb-2 lg:px-7 lg:pt-7 lg:pb-4" key={group.category}>
              <h3 className="cat text-2xl leading-[1.1] lg:text-[28px]">{group.title}</h3>
              <p className="lbl mt-1.5 mb-3 !text-[11px] lg:mt-2 lg:mb-[18px]">{group.sub}</p>
              {group.items.map(({ service, entry }) => {
                const soon = entry!.status === 'soon';
                const label = service.note ? `${service.name} (${service.note})` : service.name;
                return (
                  <div className="it" key={service.slug}>
                    <span
                      className={`flex flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 ${soon ? 'text-ink-muted' : ''}`}
                    >
                      {label}
                      {soon && <Badge variant="soon">Segera Hadir</Badge>}
                    </span>
                    <ServicePrice
                      type={service.price_type}
                      min={entry!.min ?? service.price_min}
                      max={entry!.max ?? service.price_max}
                    />
                    {!soon && (
                      <a
                        className="inline-flex min-h-11 min-w-11 items-center justify-end text-sm font-bold"
                        aria-label={`Tanya ${service.name} via WhatsApp`}
                        {...whatsAppLinkProps({
                          context: 'service',
                          settings,
                          branch,
                          service: service.name,
                        })}
                      >
                        Tanya
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 mb-0 hidden text-sm text-ink-muted lg:block">
        Status layanan mengikuti cabang terpilih. <strong className="text-ink">Segera Hadir</strong>{' '}
        = belum tersedia di cabang ini.
      </p>
    </>
  );
}
