import { useState, type ReactNode, type SyntheticEvent } from 'react';
import Icon from '@/components/ui/Icon';
import Input, { Textarea } from '@/components/ui/Input';
import { leadSchema, zodToDetails, type LeadType } from '@/lib/validation/lead';
import { whatsAppLinkProps } from '@/lib/whatsapp';
import type { WhatsAppSettings } from '@/types/content';

interface Props {
  type: LeadType;
  settings: WhatsAppSettings;
}

type Errors = Record<string, string>;

function RadioGroup(props: {
  legend: string;
  name: string;
  options: { value: string; label: ReactNode }[];
  defaultValue: string;
  error?: string;
  columns: string;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="fl">{props.legend}</legend>
      <div className={`grid gap-2 ${props.columns}`}>
        {props.options.map((option) => (
          <label className="opt" key={option.value}>
            <input
              type="radio"
              name={props.name}
              value={option.value}
              defaultChecked={option.value === props.defaultValue}
            />
            {option.label}
          </label>
        ))}
      </div>
      {props.error && <p className="err">{props.error}</p>}
    </fieldset>
  );
}

export default function LeadForm({ type, settings }: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const isAcademy = type === 'academy';
  const id = (field: string) => `${type}-${field}`;

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = leadSchema.safeParse({
      ...Object.fromEntries(form),
      type,
      consent: form.get('consent') === 'on',
    });
    if (!result.success) {
      const details = zodToDetails(result.error);
      setErrors(details);
      const first = Object.keys(details)[0];
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus({ preventScroll: false });
      return;
    }
    setErrors({});
    // M1: belum ada database (PRD F-06). M3 mengganti langkah ini dengan POST ke /api/leads.
    setSubmittedName(result.data.full_name);
  }

  if (submittedName) {
    return (
      <div className="flex flex-col items-start gap-4 py-0 lg:py-6" role="status">
        {isAcademy && (
          <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-accent-soft text-accent-strong lg:size-14">
            <Icon name="check" size={28} strokeWidth={1.8} />
          </span>
        )}
        <h3 className="m-0 font-display text-[22px] font-extrabold lg:text-[28px]">
          {isAcademy ? 'Terima kasih, minatmu sudah kami terima!' : 'Terima kasih atas minat Anda.'}
        </h3>
        <p className="body-text" style={isAcademy ? undefined : { color: '#c9cece' }}>
          {isAcademy
            ? 'Tim Golden Academy akan menghubungi kamu via WhatsApp dalam waktu dekat. Mau tanya lebih cepat? Lanjutkan percakapan sekarang.'
            : 'Tim kemitraan kami akan menghubungi Anda via WhatsApp.'}
        </p>
        <a
          className={isAcademy ? 'btn' : 'btn-w'}
          {...whatsAppLinkProps({ context: type, settings, name: submittedName })}
        >
          Lanjutkan via WhatsApp
        </a>
        {isAcademy && (
          <button
            type="button"
            className="btn-o !border-transparent !px-1"
            onClick={() => setSubmittedName(null)}
          >
            Kirim minat lain
          </button>
        )}
      </div>
    );
  }

  const optional = (
    <span className={`font-normal ${isAcademy ? 'text-ink-muted' : 'text-dark-muted'}`}>
      (opsional)
    </span>
  );

  return (
    <form className="flex flex-col gap-4 lg:gap-[18px]" onSubmit={handleSubmit} noValidate>
      {isAcademy && <h3 className="cat text-[22px] lg:text-[26px]">Form Minat Academy</h3>}

      {isAcademy ? (
        <>
          <Input
            id={id('nama')}
            name="full_name"
            label="Nama lengkap"
            autoComplete="name"
            placeholder="Nama sesuai KTP"
            required
            error={errors.full_name}
          />
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2.5 lg:grid-cols-2 lg:gap-4">
            <div className="col-span-2 lg:col-span-1">
              <Input
                id={id('wa')}
                name="whatsapp_number"
                label="Nomor WhatsApp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08xx-xxxx-xxxx"
                required
                error={errors.whatsapp_number}
              />
            </div>
            <Input
              id={id('kota')}
              name="city"
              label="Kota domisili"
              placeholder="mis. Bandung"
              required
              error={errors.city}
            />
            <div className="lg:col-span-2 lg:max-w-[calc(50%-8px)]">
              <Input
                id={id('usia')}
                name="age"
                label={<>Usia {optional}</>}
                type="number"
                inputMode="numeric"
                min={15}
                max={60}
                placeholder="Tahun"
                error={errors.age}
              />
            </div>
          </div>
          <RadioGroup
            legend="Pengalaman mencukur"
            name="experience"
            defaultValue="belum_pernah"
            error={errors.experience}
            columns="grid-cols-1 lg:grid-cols-3"
            options={[
              { value: 'belum_pernah', label: 'Belum pernah' },
              { value: 'dasar', label: 'Dasar' },
              { value: 'sudah_bekerja', label: 'Sudah bekerja sebagai barber' },
            ]}
          />
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              id={id('nama')}
              name="full_name"
              label="Nama"
              autoComplete="name"
              required
              error={errors.full_name}
            />
            <Input
              id={id('wa')}
              name="whatsapp_number"
              label="Nomor WhatsApp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xx-xxxx-xxxx"
              required
              error={errors.whatsapp_number}
            />
            <Input
              id={id('email')}
              name="email"
              label={<>Email {optional}</>}
              type="email"
              autoComplete="email"
              error={errors.email}
            />
            <Input
              id={id('kota')}
              name="city"
              label="Kota rencana lokasi"
              placeholder="mis. Bogor"
              required
              error={errors.city}
            />
          </div>
          <RadioGroup
            legend="Status lokasi"
            name="location_status"
            defaultValue="belum_ada"
            error={errors.location_status}
            columns="grid-cols-2"
            options={[
              {
                value: 'sudah_ada',
                label: (
                  <span>
                    Sudah punya<span className="hidden lg:inline"> lokasi</span>
                  </span>
                ),
              },
              { value: 'belum_ada', label: 'Belum' },
            ]}
          />
        </>
      )}

      <Textarea
        id={id('msg')}
        name="message"
        label="Pesan"
        maxLength={1000}
        placeholder={
          isAcademy ? 'Ceritakan tujuan kamu ikut Academy' : 'Ceritakan rencana dan latar belakang Anda'
        }
        error={errors.message}
      />

      {/* Honeypot: tak terlihat manusia, diisi bot. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label className="chk">
          <input type="checkbox" name="consent" aria-invalid={errors.consent ? true : undefined} />
          {isAcademy
            ? 'Saya setuju dihubungi tim Golden Academy via WhatsApp terkait informasi kelas.'
            : 'Saya setuju dihubungi tim Golden Barber terkait informasi kemitraan.'}
        </label>
        {errors.consent && <p className="err">{errors.consent}</p>}
      </div>

      <button type="submit" className={`${isAcademy ? 'btn' : 'btn-w'} btn-l`}>
        {isAcademy ? 'Kirim Minat' : 'Kirim Minat Kemitraan'}
      </button>
    </form>
  );
}
