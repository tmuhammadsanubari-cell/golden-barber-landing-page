// Ikon garis inline dari mockup. Tanpa client directive, komponen ini jadi HTML statis di .astro.
import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  whatsapp: (
    <>
      <path d="M20.5 11.6a8.6 8.6 0 0 1-12.7 7.5L3.5 20.3l1.3-4.1a8.6 8.6 0 1 1 15.7-4.6z" />
      <path d="M9.2 8.3c.2 2.9 2.6 5.6 5.6 6.2l1.2-1.4-1.9-1.1-.9.7a4.3 4.3 0 0 1-2.4-2.4l.7-.9-1.1-1.9z" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.2" />
    </>
  ),
  list: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
    </>
  ),
  threads: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.4 6.9" />
    </>
  ),
  // Nama di bawah mengikuti `about_highlights[].icon` di site-settings.json.
  'message-circle': (
    <>
      <path d="M4 5h16v11H10l-5 4v-4H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  droplets: (
    <>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  users: (
    <>
      <circle cx="6" cy="7" r="2.8" />
      <circle cx="6" cy="17" r="2.8" />
      <path d="M8.4 8.6 20 19M8.4 15.4 20 5" />
    </>
  ),
  trophy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z" />
      <path d="M12 7.5V3.2M15.8 10.3l4-1.4M14.3 14.7l2.5 3.6M9.7 14.7l-2.5 3.6M8.2 10.3l-4-1.4" />
    </>
  ),
  'heart-handshake': (
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
  ),
  star: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
    />
  ),
};

interface Props {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function Icon({ name, size = 20, strokeWidth = 1.6, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
