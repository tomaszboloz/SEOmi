import { expect, it } from 'vitest';
import { auditImagesCsv } from '@/services/export';
import type { PageAuditData } from '@/types';
it('keeps observed zero image dimensions distinct from missing dimensions in CSV', () => {
  const audit = { final_url: 'https://site.test/', timestamp: '2026-10-01T00:00:00Z', images: [
    { src: 'https://site.test/zero.png', alt: '', has_alt: true, width: 0, height: 0 },
    { src: 'https://site.test/unknown.png', alt: '', has_alt: true },
  ] } as unknown as PageAuditData;
  const rows = auditImagesCsv(audit).split('\r\n').slice(1).map(row => row.split(',').map(cell => cell.slice(1, -1)));
  expect(rows[0].slice(5, 7)).toEqual(['0', '0']);
  expect(rows[1].slice(5, 7)).toEqual(['', '']);
});
