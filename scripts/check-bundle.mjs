// Cek anggaran halaman publik dari hasil build (PRD NFR-001/NFR-002, M4 bagian 2):
// - total JS per halaman < 80 KB gzip (skrip eksternal + island + import statis/dinamis + skrip inline)
// - gambar hero ≤ 200 KB
// - tidak ada SUPABASE_SERVICE_ROLE_KEY di berkas statis
// Pakai: npm run build && node scripts/check-bundle.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = existsSync('.vercel/output/static') ? '.vercel/output/static' : 'dist/client';
const JS_BUDGET = 80 * 1024;
const HERO_BUDGET = 200 * 1024;
const PAGES = [
  'index.html',
  'cabang/dipatiukur/index.html',
  'kebijakan-privasi/index.html',
  '404.html',
];

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let failed = false;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Ikuti import relatif (statis dan dinamis) dari satu modul JS. */
function collect(file, seen) {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  for (const match of code.matchAll(/(?:from\s*|import\s*\(?\s*)["'](\.{1,2}\/[^"']+\.js)["']/g)) {
    collect(join(dirname(file), match[1]), seen);
  }
}

console.log(`Folder: ${ROOT}\n`);
for (const page of PAGES) {
  const htmlPath = join(ROOT, page);
  if (!existsSync(htmlPath)) {
    console.log(`- ${page}: tidak ada (dilewati)`);
    continue;
  }
  const html = readFileSync(htmlPath, 'utf8');
  const urlsOf = (pattern) => new Set([...html.matchAll(pattern)].map((m) => m[1]));
  // Dimuat saat halaman dibuka: <script src> dan modulepreload. Island client:visible baru
  // dimuat saat section-nya terlihat (component-url/renderer-url).
  const initialUrls = urlsOf(/(?:src|href)="(\/_astro\/[^"]+\.js)"/g);
  const islandUrls = urlsOf(
    /(?:component-url|renderer-url|before-hydration-url)="(\/_astro\/[^"]+\.js)"/g,
  );
  const sizeOf = (urls) => {
    const files = new Set();
    for (const url of urls) collect(join(ROOT, url), files);
    return { files, bytes: [...files].reduce((sum, f) => sum + gz(readFileSync(f)), 0) };
  };
  const inline = [
    ...html.matchAll(
      /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((m) => m[1])
    .reduce((sum, code) => sum + gz(Buffer.from(code)), 0);
  const initial = sizeOf(initialUrls);
  const all = sizeOf(new Set([...initialUrls, ...islandUrls]));
  const initialTotal = initial.bytes + inline;
  const ok = initialTotal < JS_BUDGET;
  failed ||= !ok;
  console.log(
    `${ok ? '✓' : '✗'} ${page}: JS saat dibuka ${kb(initialTotal)} gzip (anggaran 80 KB, D-38) · ` +
      `setelah semua island dimuat ${kb(all.bytes + inline)} (${all.files.size} berkas, inline ${kb(inline)})`,
  );
  for (const f of [...all.files].sort()) {
    const tag = initial.files.has(f) ? 'saat dibuka' : 'island';
    console.log(`    ${relative(ROOT, f)}  ${kb(gz(readFileSync(f)))}  [${tag}]`);
  }
}

// Hero: gambar <img> pertama di dalam section hero beranda (LCP), semua kandidat srcset.
const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
const heroBlock = home.match(/<section[^>]*id="top"[\s\S]*?<\/section>/)?.[0] ?? '';
const heroImgs = new Set(
  [...heroBlock.matchAll(/(?:src|srcset)="([^"]+)"/g)]
    .flatMap((m) => m[1].split(',').map((part) => part.trim().split(/\s+/)[0]))
    .filter((url) => url.startsWith('/') && !url.endsWith('.js')),
);
console.log('');
if (heroImgs.size === 0) console.log('! Gambar hero tidak ditemukan di section#top (cek manual).');
for (const url of heroImgs) {
  const path = join(ROOT, decodeURIComponent(url.split('?')[0]));
  if (!existsSync(path)) {
    console.log(`! hero ${url}: dilayani on-demand (/_image), cek ukuran di situs terdeploy`);
    continue;
  }
  const size = statSync(path).size;
  const ok = size <= HERO_BUDGET;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} hero ${url}: ${kb(size)}`);
}

// Service role key tidak boleh ada di berkas statis mana pun.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('');
if (!key) {
  console.log('! SUPABASE_SERVICE_ROLE_KEY tidak diset di lingkungan; cek kunci dilewati.');
} else {
  const leaks = [...walk(ROOT), ...(existsSync('dist') ? walk('dist') : [])].filter((f) =>
    readFileSync(f).includes(key),
  );
  failed ||= leaks.length > 0;
  console.log(
    leaks.length
      ? `✗ service role key ditemukan di: ${leaks.join(', ')}`
      : '✓ service role key tidak ada di berkas statis',
  );
}

process.exit(failed ? 1 : 0);
