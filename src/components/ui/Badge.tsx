import type { ReactNode } from 'react';

type Variant = 'pusat' | 'baru' | 'soon' | 'photo';

interface Props {
  variant: Variant;
  className?: string;
  children: ReactNode;
}

export default function Badge({ variant, className = '', children }: Props) {
  return <span className={`tag tag-${variant} ${className}`}>{children}</span>;
}
