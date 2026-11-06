import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  id: string;
  label: ReactNode;
  error?: string;
}

function Field({ id, label, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div>
      <label className="fl" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p className="err" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

const errorProps = (id: string, error?: string) =>
  error ? { 'aria-invalid': true, 'aria-describedby': `${id}-err` } : {};

export default function Input({
  id,
  label,
  error,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field id={id} label={label} error={error}>
      <input id={id} className="inp" {...errorProps(id, error)} {...rest} />
    </Field>
  );
}

export function Textarea({
  id,
  label,
  error,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field id={id} label={label} error={error}>
      <textarea id={id} className="inp" {...errorProps(id, error)} {...rest} />
    </Field>
  );
}
