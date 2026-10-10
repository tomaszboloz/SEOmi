import { describe, expect, it } from 'vitest';
import { csv, escapeCsv } from '@/services/export/csv';
import { csvCell, pageSpeedHistoryCsv } from '@/services/pagespeedHistory/csv';
import { crawlLinksCsv } from '@/services/crawlLinkFilters';
import { historySnapshot } from './fixtures/pageSpeedHistory';

describe('shared spreadsheet-safe CSV export contract', () => {
  it('keeps the public PageSpeed cell helper bound to the shared encoder', () => {
    expect(csvCell).toBe(escapeCsv);
    expect(escapeCsv(null)).toBe('""');
    expect(escapeCsv(undefined)).toBe('""');
    expect(escapeCsv(0)).toBe('"0"');
  });
  it.each([
    ['=SUM(1)', '"\'=SUM(1)"'],
    ['+cmd', '"\'+cmd"'],
    ['-1', '"\'-1"'],
    ['@formula', '"\'@formula"'],
    [' \t=SUM(1)', '"\' \t=SUM(1)"'],
    ['a"b', '"a""b"'],
    ['Żółć, kawa', '"Żółć, kawa"'],
  ])('preserves safe encoding in every affected export for %j', (value, expected) => {
    expect(csv([[value]])).toBe(expected);
    const history = pageSpeedHistoryCsv([historySnapshot({ url: value })]).split('\r\n')[1];
    expect(history).toContain(`,${expected},`);
    const links = crawlLinksCsv([{ key: 'fixture', sourceUrl: value,
      link: { target_url: 'https://example.test/', is_internal: true, anchor_text: value } }]).split('\r\n')[1];
    expect(links.startsWith(`${expected},`)).toBe(true);
    expect(links).toContain(`,${expected},`);
  });
});
