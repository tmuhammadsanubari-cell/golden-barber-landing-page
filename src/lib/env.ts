// Baca variabel lingkungan di kode server/build.
// Astro/Vite mengisi import.meta.env dari file .env; skrip Node & CI memakai process.env.
// Jangan import file ini dari komponen client (variabel non-PUBLIC tidak ada di sana).
export function env(name: string): string | undefined {
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  if (fromVite !== undefined && fromVite !== '') return fromVite;
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  return fromProcess !== undefined && fromProcess !== '' ? fromProcess : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (value === undefined) {
    throw new Error(`Variabel lingkungan ${name} belum diisi. Lihat .env.example.`);
  }
  return value;
}
