import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  id: string;
  label: ReactNode;
  error?: string;
}

type InputProps = BaseProps & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseProps & { multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Input(props: InputProps | TextareaProps) {
  const errorId = `${props.id}-err`;
  const a11y = {
    'aria-invalid': props.error ? true : undefined,
    'aria-describedby': props.error ? errorId : undefined,
  };

  let control: ReactNode;
  if (props.multiline) {
    const { label: _label, error: _error, multiline: _multiline, ...rest } = props;
    control = <textarea className="inp" {...a11y} {...rest} />;
  } else {
    const { label: _label, error: _error, multiline: _multiline, ...rest } = props;
    control = <input className="inp" {...a11y} {...rest} />;
  }

  return (
    <div>
      <label className="fl" htmlFor={props.id}>
        {props.label}
      </label>
      {control}
      {props.error && (
        <p className="err" id={errorId}>
          {props.error}
        </p>
      )}
    </div>
  );
}
