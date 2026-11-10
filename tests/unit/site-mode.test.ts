import { describe, expect, it } from 'vitest';
import { parseSiteMode } from '@/lib/site-mode';
import { robotsTxt } from '@/pages/robots.txt';

describe('parseSiteMode (D-41)', () => {
  it('default prototipe bila kosong atau nilai lain', () => {
    expect(parseSiteMode(undefined)).toBe('prototype');
    expect(parseSiteMode('')).toBe('prototype');
    expect(parseSiteMode('prototype')).toBe('prototype');
    expect(parseSiteMode('resmi')).toBe('prototype');
  });

  it('live hanya bila diisi "live" (tanpa peka huruf besar/spasi)', () => {
    expect(parseSiteMode('live')).toBe('live');
    expect(parseSiteMode(' LIVE ')).toBe('live');
  });
});

describe('robotsTxt', () => {
  it('mode live menunjuk sitemap', () => {
    const txt = robotsTxt('https://contoh.id/', false);
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Sitemap: https://contoh.id/sitemap-index.xml');
  });

  it('mode prototipe tetap boleh dirayapi tetapi tanpa sitemap', () => {
    const txt = robotsTxt('https://contoh.id', true);
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /api');
    expect(txt).not.toContain('Sitemap:');
  });
});
