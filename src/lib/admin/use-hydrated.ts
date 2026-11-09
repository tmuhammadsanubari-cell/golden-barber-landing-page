// Penanda hidrasi island yang andal. Atribut `ssr` milik Astro sudah dicopot sebelum React
// selesai menghidrasi, jadi tes (dan pengguna cepat) yang mengetik di saat itu bisa tertimpa.
// Elemen dengan `data-hydrated` bernilai "false" di HTML server dan "true" setelah efek pertama.
import { useEffect, useState } from 'react';

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
