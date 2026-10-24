import { expect, it } from 'vitest';
import { offPageCsvFilename, offPageHistoryCsv } from '@/services/offPage/historyCsv';
import { historyRecord } from './fixtures/offPageHistory';

it('exports the exact source and co-citation columns with stable machine-readable values', () => {
  const lines = offPageHistoryCsv(historyRecord()).split('\r\n');
  expect(lines).toEqual([
    '"section","source_url","fetched_at","availability","authority","similarity","contribution","offset","linked","excerpt"',
    '"source","https://source.test/page","2026-10-24T09:00:00.000Z","ok","80","1","0.8","","",""',
    '"co_citation","https://source.test/page","2026-10-24T09:00:00.000Z","ok","80","1","0.8","0","false","Acme SEO"',
  ]);
});

it.each(['=SUM(A1)', '+1', '-1', '@command', ' \t=HYPERLINK("bad")', '\r\n+1'])('neutralizes spreadsheet formulas %j', (excerpt) => {
  const record = historyRecord();
  record.coCitations[0].excerpt = excerpt;
  record.sources[0].sourceUrl = excerpt;
  const output = offPageHistoryCsv(record);
  expect(output).toContain(`"'${excerpt.replaceAll('"', '""')}"`);
});

it('quotes commas, quotes and newlines, keeps zero distinct from missing evidence and handles unmatched citations', () => {
  const record = historyRecord();
  record.sources[0] = { ...record.sources[0], fetchedAt: null, availability: null, authority: null, similarity: 0, contribution: 0 };
  record.coCitations[0] = { ...record.coCitations[0], sourceUrl: 'https://other.test', excerpt: 'a,"b"\nc', linked: true };
  const output = offPageHistoryCsv(record);
  expect(output).toContain('"source","https://source.test/page","","","","0","0"');
  expect(output).toContain('"co_citation","https://other.test","","","","","","0","true","a,""b""\nc"');
});

it('exports an empty sample and creates a safe project/date filename', () => {
  expect(offPageHistoryCsv(historyRecord({ sources: [], coCitations: [] })).split('\r\n')).toHaveLength(1);
  expect(offPageCsvFilename('project-1', '2026-10-24T10:00:00.000Z')).toBe('seomi-offpage-project-1-2026-10-24.csv');
  expect(offPageCsvFilename('../odd/path @', '2026-10-24')).toBe('seomi-offpage-___odd_path__-2026-10-24.csv');
});
