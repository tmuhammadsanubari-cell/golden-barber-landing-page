import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  CSV_HEADER,
  csvCell,
  csvFilename,
  csvRow,
  datestamp,
  formatLeadDate,
  formatLeadStamp,
  formatLeadTime,
  leadFields,
  leadWhatsAppUrl,
  sanitizeSearch,
  searchClause,
  type LeadRow,
} from '@/lib/admin/leads';
import { leadPatchSchema, leadQuerySchema } from '@/lib/validation/admin-leads';

const academy: LeadRow = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'academy',
  full_name: 'Dimas Pratama',
  whatsapp_number: '6281200000101',
  city: 'Bandung',
  message: 'Saya ingin belajar dari nol.',
  extra: { age: 19, experience: 'belum_pernah' },
  consent: true,
  status: 'new',
  admin_note: null,
  handled_by: null,
  ip_hash: 'a'.repeat(64),
  user_agent: null,
  source_path: '/',
  created_at: '2026-11-04T02:12:00.000Z', // 09.12 WIB
  updated_at: '2026-11-04T02:12:00.000Z',
};

const partnership: LeadRow = {
  ...academy,
  id: '22222222-2222-4222-8222-222222222222',
  type: 'partnership',
  full_name: 'Hendra Wijaya',
  city: 'Bogor',
  message: null,
  extra: { email: 'hendra@contoh.id', location_status: 'sudah_ada' },
};

describe('format tanggal (WIB)', () => {
  it('tanggal, jam, dan stempel CSV memakai Asia/Jakarta', () => {
    expect(formatLeadDate(academy.created_at)).toBe('4 Nov 2026');
    expect(formatLeadTime(academy.created_at)).toBe('09.12');
    expect(formatLeadStamp(academy.created_at)).toBe('2026-11-04 09:12');
  });

  it('lewat tengah malam UTC tetap tanggal WIB yang benar', () => {
    // 2026-11-04 18:30 UTC = 2026-11-05 01:30 WIB
    expect(formatLeadStamp('2026-11-04T18:30:00.000Z')).toBe('2026-11-05 01:30');
    expect(datestamp(new Date('2026-11-04T18:30:00.000Z'))).toBe('20261105');
  });
});

describe('leadFields', () => {
  it('Academy: usia dan pengalaman berlabel Indonesia', () => {
    const fields = Object.fromEntries(leadFields(academy).map((f) => [f.label, f.value]));
    expect(fields['Nama lengkap']).toBe('Dimas Pratama');
    expect(fields['Nomor WhatsApp']).toBe('0812-0000-0101');
    expect(fields['Kota domisili']).toBe('Bandung');
    expect(fields['Usia']).toBe('19');
    expect(fields['Pengalaman mencukur']).toBe('Belum pernah');
    expect(fields['Pesan']).toBe('Saya ingin belajar dari nol.');
    expect(fields['Setuju dihubungi']).toBe('Ya');
  });

  it('Kemitraan: email dan status lokasi; pesan kosong jadi tanda strip', () => {
    const fields = Object.fromEntries(leadFields(partnership).map((f) => [f.label, f.value]));
    expect(fields['Kota rencana lokasi']).toBe('Bogor');
    expect(fields['Email']).toBe('hendra@contoh.id');
    expect(fields['Status lokasi']).toBe('Sudah punya lokasi');
    expect(fields['Pesan']).toBe('—');
    expect(fields).not.toHaveProperty('Usia');
  });

  it('extra kosong atau bukan objek tidak membuat error', () => {
    expect(() => leadFields({ ...academy, extra: {} })).not.toThrow();
    expect(() => leadFields({ ...academy, extra: [] })).not.toThrow();
    expect(() => leadFields({ ...academy, extra: null as never })).not.toThrow();
  });
});

describe('leadWhatsAppUrl', () => {
  it('wa.me/{nomor lead} dengan sapaan awal berisi nama', () => {
    const url = leadWhatsAppUrl(academy);
    expect(url.startsWith('https://wa.me/6281200000101?text=')).toBe(true);
    const text = decodeURIComponent(url.split('?text=')[1]!);
    expect(text).toContain('Halo Dimas Pratama');
    expect(text).toContain('Golden Academy');
    expect(decodeURIComponent(leadWhatsAppUrl(partnership).split('?text=')[1]!)).toContain(
      'kemitraan',
    );
  });
});

describe('pencarian', () => {
  it('sanitizeSearch membuang karakter pemecah filter PostgREST', () => {
    expect(sanitizeSearch('a,b)c(d"e\'f\\g%h*i_j:k')).toBe('a b c d e f g h i j k');
    expect(sanitizeSearch('  banyak   spasi  ')).toBe('banyak spasi');
    expect(sanitizeSearch('x'.repeat(300))).toHaveLength(100);
  });

  it('searchClause: nama + kota; nomor bila ada ≥ 3 digit', () => {
    expect(searchClause('')).toBeNull();
    expect(searchClause('   ')).toBeNull();
    expect(searchClause('dimas')).toBe('full_name.ilike.*dimas*,city.ilike.*dimas*');
    expect(searchClause('0812-0000')).toContain('whatsapp_number.ilike.*628120000*');
    expect(searchClause('62812')).toContain('whatsapp_number.ilike.*62812*');
    expect(searchClause('dimas 123')).toContain('whatsapp_number.ilike.*123*');
  });

  it('input jahat tidak menambah klausul filter baru', () => {
    const clause = searchClause('x),status.eq.new,(y')!;
    expect(clause.split(',')).toHaveLength(2); // hanya full_name dan city
    expect(clause).not.toContain('(');
  });
});

describe('CSV', () => {
  it('csvCell: kutip, koma, baris baru, dan rumus spreadsheet dinetralkan', () => {
    expect(csvCell('biasa')).toBe('biasa');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('dia bilang "hai"')).toBe('"dia bilang ""hai"""');
    expect(csvCell('baris1\nbaris2')).toBe('"baris1\nbaris2"');
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+62812')).toBe("'+62812");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });

  it('csvRow mengikuti urutan CSV_HEADER', () => {
    const cells = csvRow(academy).split(',');
    expect(CSV_HEADER).toHaveLength(13);
    expect(cells[0]).toBe('2026-11-04 09:12');
    expect(cells[1]).toBe('Academy');
    expect(cells[2]).toBe('Dimas Pratama');
    expect(cells[3]).toBe('6281200000101');
    expect(csvRow(partnership)).toContain('hendra@contoh.id');
  });

  it('BOM UTF-8 dan nama berkas leads-{type}-{YYYYMMDD}.csv', () => {
    expect(CSV_BOM).toBe('﻿');
    const day = new Date('2026-11-04T05:00:00.000Z');
    expect(csvFilename('academy', day)).toBe('leads-academy-20261104.csv');
    expect(csvFilename('partnership', day)).toBe('leads-partnership-20261104.csv');
    expect(csvFilename(null, day)).toBe('leads-semua-20261104.csv');
  });
});

describe('skema query & patch', () => {
  it('query: kosong → page 1; nilai tak dikenal ditolak', () => {
    expect(leadQuerySchema.parse({})).toEqual({ page: 1 });
    expect(leadQuerySchema.parse({ type: 'academy', status: '', q: '', page: '3' })).toEqual({
      type: 'academy',
      page: 3,
    });
    expect(leadQuerySchema.safeParse({ type: 'lain' }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ status: 'x' }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ id: 'bukan-uuid' }).success).toBe(false);
  });

  it('patch: minimal satu field; status valid; catatan ≤ 2000', () => {
    expect(leadPatchSchema.safeParse({}).success).toBe(false);
    expect(leadPatchSchema.safeParse({ status: 'contacted' }).success).toBe(true);
    expect(leadPatchSchema.safeParse({ admin_note: '' }).success).toBe(true);
    expect(leadPatchSchema.safeParse({ status: 'selesai' }).success).toBe(false);
    expect(leadPatchSchema.safeParse({ admin_note: 'x'.repeat(2001) }).success).toBe(false);
  });
});
