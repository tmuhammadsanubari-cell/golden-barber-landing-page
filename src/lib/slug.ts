// Slug URL dari nama (PRD F-16): hapus diakritik, huruf kecil, selain a–z/0–9 jadi "-".

/** "Pasgar TKI 2" → "pasgar-tki-2"; "Café  Ünik!" → "cafe-unik". */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
