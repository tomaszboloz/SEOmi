import { expect, it } from 'vitest';
import { spreadsheetSafe, escapeCsv, csv, exportText, exportHeaders } from '@/services/export/csv';
import { reportFilename, auditTableFilename, crawlFilename } from '@/services/export/filenames';
import { crawlMetadata, crawlCsv } from '@/services/export/crawlMetadata';
import { audit, crawlRun } from './fixtures/export';
import i18n from '@/i18n';

it.each(['=formula', '+formula', '-formula', '@formula', ' \t=after whitespace', '\r\n@after newline'])('neutralizes a dangerous spreadsheet prefix without changing its content %j', value => {
  expect(spreadsheetSafe(value)).toBe(`'${value}`); expect(escapeCsv(value)).toBe(`"'${value}"`);
});
it.each([null, undefined, '', 0, false, 'observed'])('preserves ordinary or unavailable values in CSV %j', value => {
  expect(spreadsheetSafe(value)).toBe(String(value ?? ''));
});
it('quotes embedded delimiters, quotes and line breaks and uses CRLF between rows', () => {
  expect(escapeCsv('quote";comma,')).toBe('"quote"";comma,"');
  expect(csv([['a,b', 'one\ntwo'], [0, false]])).toBe('"a,b","one\ntwo"\r\n"0","false"');
});
it('loads localized headers and labels while keeping unknown header evidence empty', () => {
  expect(exportText('statuses.http', { status: 404 })).toBe(i18n.t('exportUi.statuses.http', { status: 404 }));
  expect(exportHeaders('auditLinks')).toEqual(i18n.t('exportUi.headers.auditLinks', { returnObjects: true }));
  expect(exportHeaders('__unsupported__')).toEqual([]);
});
it('creates deterministic safe report filenames from the recorded host and timestamp', () => {
  expect(reportFilename(audit, 'json')).toBe('seomi-audit-example.com-2026-09-20.json');
  expect(auditTableFilename(audit, 'images')).toBe('seomi-audit-example.com-20260920120000-images.csv');
  expect(crawlFilename(crawlRun, 'urls', 'csv')).toBe('seomi-crawl-example.com-20260921090000-urls.csv');
  expect(crawlFilename({ ...crawlRun, startUrl: 'invalid', completedAt: '', id: 'run-1' }, 'report', 'pdf')).toBe('seomi-crawl-crawl-run1-report.pdf');
  expect(crawlFilename({ ...crawlRun, startUrl: 'file:///' }, 'report', 'json')).toContain('seomi-crawl-crawl-');
  expect(() => reportFilename({ ...audit, final_url: 'invalid' }, 'csv')).toThrow();
});
it('preserves the recorded crawl context when a selected table has no rows', () => {
  const metadata = crawlMetadata({ ...crawlRun, environment: 'staging' });
  expect(metadata).toEqual({ run_id: crawlRun.id, completed_at: crawlRun.completedAt, scope_start_url: crawlRun.startUrl, environment: 'staging', crawl_configuration: JSON.stringify(crawlRun.config) });
  expect(crawlCsv(['Run', 'Completed', 'Scope', 'Configuration'], [], metadata))
    .toBe(csv([['Run', 'Completed', 'Scope', 'Configuration'], [crawlRun.id, crawlRun.completedAt, crawlRun.startUrl, JSON.stringify(crawlRun.config)]]));
  expect(crawlCsv(['Run', 'Completed', 'Scope'], [], metadata))
    .toBe(csv([['Run', 'Completed', 'Scope'], [crawlRun.id, crawlRun.completedAt, crawlRun.startUrl]]));
  expect(crawlCsv(['Column'], [['observed']], metadata)).toBe('"Column"\r\n"observed"');
});
