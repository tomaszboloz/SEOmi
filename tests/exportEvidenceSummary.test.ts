import { beforeEach, expect, it, vi } from 'vitest';
import { downloadCrawlPdf } from '@/services/export/crawlReport';
import { crawlEvidenceSummary, EVIDENCE_ROWS } from '@/services/export/evidenceSummary';
import { addIntervention } from '@/services/experiments/registry';
import { savePageSeries } from '@/services/experiments/pageSeries';
import { appendSerpSnapshot } from '@/services/semanticDecay/snapshotStore';
import { rememberRevenueImport, type RevenueImport } from '@/services/urlTelemetry';
import { DEFAULT_CRAWL_REPORT_TEMPLATE } from '@/services/reportTemplates';
import { createCrawlRunFixture } from './fixtures/crawl';
import { historySnapshot } from './fixtures/decayHistory';
import { readGscSnapshots } from '@/services/gscTracker/read';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { experimentNow, experimentUrl } from './fixtures/experiments';

const { downloadPdf } = vi.hoisted(() => ({ downloadPdf: vi.fn() }));
vi.mock('@/services/export/download', () => ({ downloadPdf, downloadText: vi.fn() }));
vi.mock('@/services/gscTracker/read', () => ({ readGscSnapshots: vi.fn(() => []) }));
const day = (i: number) => new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10);
const noise = (i: number) => ((i * 7919) % 13) - 6;
const gsc = (site: string, values: number[]) => ({ site_url: site, start_date: day(0), end_date: day(values.length - 1), captured_at: '2026-10-01T00:00:00Z', filters: {}, daily: values.map((clicks, i) => ({ date: day(i), clicks, impressions: clicks * 10, ctr: 0.1, position: 5 })) }) as unknown as GscPerformanceSnapshot;
const run = createCrawlRunFixture({ projectId: 'p1' });
const NOW = new Date('2026-11-01T00:00:00Z');
const revenue = (rows: RevenueImport['rows'], period: RevenueImport['period'] = { start: '2026-07-01', end: '2026-09-30' }): RevenueImport => ({
  provider: 'ga4-api', attribution: 'ga4-session-landing-page', currency: 'PLN', organicOnly: true, period, sourceFile: 'f', importedAt: NOW.toISOString(), truncated: false, rows,
});
beforeEach(() => { localStorage.clear(); downloadPdf.mockReset(); });

it('has nothing to say without a project or saved data', () => {
  expect(crawlEvidenceSummary(createCrawlRunFixture(), NOW)).toBeUndefined();
  expect(crawlEvidenceSummary(run, NOW)).toBeUndefined();
});

it('summarises the top revenue pages, with or without a stated period', () => {
  const rows = Array.from({ length: EVIDENCE_ROWS + 3 }, (_, i) => ({ landingPage: `/p${i}`, revenue: i }));
  rememberRevenueImport('p1', revenue(rows));
  const summary = crawlEvidenceSummary(run, NOW)!;
  expect(summary.revenue).toMatchObject({ currency: 'PLN', period: '2026-07-01 – 2026-09-30' });
  expect(summary.revenue!.pages).toHaveLength(EVIDENCE_ROWS);
  expect(summary.revenue!.pages[0]).toEqual({ page: `/p${EVIDENCE_ROWS + 2}`, revenue: EVIDENCE_ROWS + 2 });
  rememberRevenueImport('p1', revenue([{ landingPage: '/a', revenue: 1 }], null));
  expect(crawlEvidenceSummary(run, NOW)!.revenue!.period).toBeNull();
});

it('lists site and page experiments with their estimate and skips ones without a series', () => {
  addIntervention('p1', { url: 'site', date: day(60), kind: 'content', note: '' }, experimentNow);
  addIntervention('p1', { url: experimentUrl, date: '2026-09-11', kind: 'content', note: '' }, new Date(experimentNow.getTime() + 1000));
  expect(crawlEvidenceSummary(run, NOW, 'https://shop.test/')).toBeUndefined();
  const control = Array.from({ length: 90 }, (_, i) => 200 + 40 * Math.sin(i / 3) + noise(i));
  const test = control.map((value, i) => 0.5 * value + 20 + noise(i + 3) * 0.5 + (i >= 60 ? 30 : 0));
  vi.mocked(readGscSnapshots).mockReturnValue([gsc('sc-domain:shop.test', test), gsc('sc-domain:control.test', control)]);
  const site = crawlEvidenceSummary(run, NOW, 'https://shop.test/')!.experiments!;
  expect(site).toHaveLength(1);
  expect(site[0]).toMatchObject({ target: 'site', method: 'structural', status: 'estimated' });
  const dates = Array.from({ length: 60 }, (_, i) => new Date(Date.parse('2026-08-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10));
  savePageSeries('p1', experimentUrl, { site: 's', fetchedAt: NOW.toISOString(), daily: dates.map((date, i) => ({ date, clicks: 100 + ((i * 7) % 5) + (date >= '2026-09-11' ? 30 : 0) })) });
  const withPage = crawlEvidenceSummary(run, NOW)!.experiments!;
  expect(withPage.find((item) => item.target === experimentUrl)).toMatchObject({ method: 'structural', status: 'estimated' });
  vi.mocked(readGscSnapshots).mockReturnValue([gsc('sc-domain:shop.test', test)]);
  const short = [gsc('sc-domain:shop.test', test.slice(0, 20))];
  vi.mocked(readGscSnapshots).mockReturnValue(short);
  expect(crawlEvidenceSummary(run, NOW, 'https://shop.test/')!.experiments!.find((item) => item.target === 'site')).toMatchObject({ method: 'structural', status: 'not-estimable' });
});

it('reports SERP drift per saved history using the injected clock', () => {
  [0, 1].forEach((i) => appendSerpSnapshot('p1', historySnapshot(i)));
  const few = crawlEvidenceSummary(run, NOW)!.decay!;
  expect(few).toEqual([{ query: 'query', verdict: 'too-few-samples', samples: 2, centroid_shift: null, new_entities: 0, lost_entities: 0 }]);
  [2, 3, 4].forEach((i) => appendSerpSnapshot('p1', historySnapshot(i, { centroid: new Float64Array([0, 1]), consensusEntities: ['a', 'b', 'c', 'd'] })));
  const drift = crawlEvidenceSummary(run, NOW)!.decay![0];
  expect(drift).toMatchObject({ verdict: 'alert', samples: 5, new_entities: 4, lost_entities: 1 });
  expect(drift.centroid_shift).toBeGreaterThan(0.1);
});

it('adds the evidence block to the PDF payload only when the template allows it', async () => {
  rememberRevenueImport('p1', revenue([{ landingPage: '/a', revenue: 1 }]));
  await downloadCrawlPdf(run);
  expect(downloadPdf.mock.calls[0][1].run).toHaveProperty('evidence');
  await downloadCrawlPdf(run, { ...DEFAULT_CRAWL_REPORT_TEMPLATE, sections: ['summary'] });
  expect(downloadPdf.mock.calls[1][1].run).not.toHaveProperty('evidence');
  localStorage.clear();
  await downloadCrawlPdf(run);
  expect(downloadPdf.mock.calls[2][1].run).not.toHaveProperty('evidence');
});

it('uses the real clock by default', () => {
  appendSerpSnapshot('p1', historySnapshot(0));
  expect(crawlEvidenceSummary(run)!.decay![0].verdict).toBe('too-few-samples');
});
