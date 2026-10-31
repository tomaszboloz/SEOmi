import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { downloadCrawlPdf } from '@/services/export';
import { AUTHORITY_PDF_GAPS, crawlAuthoritySummary, summarizeAuthority } from '@/services/export/authoritySummary';
import { REPORT_TEMPLATE_SECTIONS } from '@/services/reportTemplates';
import { invokeTauriCommand } from '@/services/tauri';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { writeTaxonomy, writeTopicalBenchmark } from '@/services/topicalAuthorityMonitoring';
import type { CrawlRunRecord } from '@/types';
import en from '@/i18n/locales/en.json';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));
// Pin the clock next to the fixture date: cached maps expire after 30 days (TAXONOMY_TTL_DAYS).
beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.mocked(invokeTauriCommand).mockReset(); vi.useRealTimers(); });

const START = `https://${OWN_HOST}/`;
const runOf = (pages = ownSite(), patch: Record<string, unknown> = {}) => ({
  id: 'run-auth', projectId: 'p1', completedAt: NOW, startUrl: START, config: {},
  result: { start_url: START, pages, resources: [], ...patch },
}) as unknown as CrawlRunRecord;

it('summarises the report compactly with gaps, groups, plan and benchmark rows', () => {
  const pages = ownSite();
  const taxonomy = referenceTaxonomy(pages)!;
  const extended = { ...taxonomy, subtopics: [...taxonomy.subtopics, ...Array.from({ length: 25 }, (_, index) => ({ id: `g-${index}`, pillar: 'general', label: `gap ${index}`, keys: [`gapkey${index}`], importance: 0.3 + index / 100, entities: [], questions: [] }))] };
  const report = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: extended, now: NOW });
  const summary = summarizeAuthority(report, [{ domain: 'a.test', sfs: 80, tas: null }]);
  expect(summary.tas).toBe(report.tas);
  expect(summary.gaps).toHaveLength(AUTHORITY_PDF_GAPS);
  expect(summary.gaps[0].weight).toBeGreaterThanOrEqual(summary.gaps[1].weight);
  expect(summary.reference).toMatchObject({ pillars: extended.pillars.length, source: 'bing-rss' });
  expect(summary.cannibalization[0]).toMatchObject({ pages: 2 });
  expect(summary.recommendations[0]).toMatchObject({ code: expect.any(String), gain: expect.any(Number) });
  expect(summary.benchmark).toEqual([{ domain: 'a.test', sfs: 80, tas: null }]);
  expect(JSON.stringify(summary)).not.toContain('commonTerms');
  const bare = summarizeAuthority(buildAuthorityReport(pages, START, ownReport(pages), { now: NOW }));
  expect(bare).toMatchObject({ tas: null, reference: null, gaps: [], benchmark: [] });
  // #62 GEM-62-05: PAA source and partial CDES go to the PDF from the same report DTO, never recomputed.
  expect(summary.reference?.paa).toBe(0);
  expect(summary.depth_inputs).toEqual({ status: report.depthInputs!.status, rows: report.depthInputs!.rows, missing: report.depthInputs!.missing });
  const withPaa = summarizeAuthority({ ...report, taxonomy: { ...report.taxonomy!, paaCount: 3 }, depthInputs: undefined });
  expect(withPaa).toMatchObject({ reference: { paa: 3 }, depth_inputs: null });
  expect(summarizeAuthority({ ...report, taxonomy: { ...report.taxonomy!, paaCount: undefined } }).reference?.paa).toBe(0);
});

it('builds a run summary from the cached map and benchmark, only for completed runs', () => {
  expect(crawlAuthoritySummary(runOf())?.reference).toBeNull();
  writeTaxonomy('p1', referenceTaxonomy()!);
  writeTopicalBenchmark('p1', { builtAt: NOW, source: 's', ownRank: 1, insights: [], pillars: [], rows: [{ domain: 'a.test', sfs: 70, tas: 50, quadrant: null, isOwn: false }] });
  const summary = crawlAuthoritySummary(runOf());
  expect(summary?.reference?.competitors).toBe(3);
  expect(summary?.benchmark).toEqual([{ domain: 'a.test', sfs: 70, tas: 50 }]);
  expect(crawlAuthoritySummary(runOf([]))).toBeUndefined();
  expect(crawlAuthoritySummary(runOf(ownSite(), { cancelled: true }))).toBeUndefined();
});

it('sends the authority summary with the PDF payload when the template allows it', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-1.7'));
  const run = runOf();
  const sent = (index: number) => (vi.mocked(invokeTauriCommand).mock.calls[index][1] as { run: Record<string, unknown> }).run;
  const template = { id: 't', name: 'T', createdAt: '', updatedAt: '' };
  await downloadCrawlPdf(run);
  expect(sent(0).authority).toMatchObject({ pillars: expect.any(Object), recommendations: expect.any(Array) });
  await downloadCrawlPdf(run, { ...template, sections: ['summary', 'authority'] });
  expect(sent(1).authority).toBeDefined();
  await downloadCrawlPdf(run, { ...template, sections: ['summary'] });
  expect(sent(2)).not.toHaveProperty('authority');
  await downloadCrawlPdf(runOf([]));
  expect(sent(3)).not.toHaveProperty('authority');
});

it('offers the authority section in report templates', () => {
  expect(REPORT_TEMPLATE_SECTIONS).toContain('authority');
  expect(en.siteAudit.reportSections.authority).toBeTruthy();
});
