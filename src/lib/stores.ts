import { atom } from 'nanostores';

/** Slug cabang terpilih, dibagi antara pricelist, layanan, dan tombol "Lihat Harga". */
export const selectedBranch = atom<string | null>(null);

/** Pilih cabang dan sinkronkan ke URL (`?cabang=dago#harga`) agar bisa dibagikan. */
export function selectBranch(slug: string): void {
  selectedBranch.set(slug);
  const url = new URL(window.location.href);
  url.searchParams.set('cabang', slug);
  url.hash = 'harga';
  history.replaceState(null, '', url);
}

/** Baca `?cabang=` sekali saat island pertama hidup. Tidak menimpa pilihan yang sudah ada. */
export function initSelectedBranchFromUrl(): void {
  if (selectedBranch.get()) return;
  const slug = new URLSearchParams(window.location.search).get('cabang');
  if (slug) selectedBranch.set(slug);
}
