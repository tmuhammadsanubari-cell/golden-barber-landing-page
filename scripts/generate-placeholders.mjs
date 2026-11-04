// Membuat foto dummy (blok abu bergaris seperti mockup), favicon, dan gambar OG.
// Jalankan sekali: node scripts/generate-placeholders.mjs. Ganti dengan foto asli saat tersedia.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const DUMMY_DIR = 'public/images/dummy';
mkdirSync(DUMMY_DIR, { recursive: true });

const stripes = (width, height) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="2" height="16" fill="rgba(255,255,255,.13)" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="#B4B8B8" />
  <rect width="100%" height="100%" fill="url(#p)" />
</svg>`;

const dummy = async (name, width, height) =>
  sharp(Buffer.from(stripes(width, height)))
    .webp({ quality: 70 })
    .toFile(`${DUMMY_DIR}/${name}.webp`);

await dummy('hero', 640, 680);
await dummy('cabang', 1200, 800);
for (let index = 1; index <= 8; index += 1) await dummy(`galeri-${index}`, 300, 300);

writeFileSync(
  'public/brand/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2B2F2F"/><text x="16" y="23" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="21" fill="#FFFFFF">G</text></svg>\n`,
);

const logoWidth = 800;
const logo = await sharp('public/brand/logo-golden-barber.png').resize({ width: logoWidth }).toBuffer();
const logoHeight = (await sharp(logo).metadata()).height;
await sharp({
  create: { width: 1200, height: 630, channels: 3, background: '#ECECEC' },
})
  .composite([
    { input: logo, left: (1200 - logoWidth) / 2, top: Math.round((630 - logoHeight) / 2) - 40 },
    {
      input: Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="60">
  <text x="600" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" letter-spacing="6" fill="#5B6161">CHOOSE YOUR HAIRCUT  |  THE WINNER'S CUT</text>
</svg>`),
      left: 0,
      top: 370,
    },
  ])
  .jpeg({ quality: 85 })
  .toFile('public/brand/og-default.jpg');
