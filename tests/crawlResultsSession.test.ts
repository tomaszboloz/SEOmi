import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useCrawlResultsSession, type CrawlResultsDependencies } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import { readCrawlNavigationPreferences, readCrawlLinkNavigationPreferences, normalizeLinkUrl, loadFilterPresets } from '@/components/Domain/crawlResults/crawlResultsHelpers';
import { useProjectStore } from '@/stores/projectStore';
import type { CrawlRunRecord, SiteCrawlResult } from '@/types';
import '@/i18n';

const result: SiteCrawlResult = {
  start_url: 'https://example.com/', crawl_mode: 'browser-rendered', pages_crawled: 0,
  health_score: 0, critical_count: 0, warning_count: 0, notice_count: 0,
  duration_ms: 0, cancelled: false, pages: [], robots_txt_status: 'unavailable',
  robots_blocked_count: 0, sitemap_status: 'unavailable', sitemap_urls_discovered: 0, sitemap_urls: [],
};
const run: CrawlRunRecord = {
  id: 'test-run', completedAt: '2026-10-01T00:00:00Z', startUrl: result.start_url, result,
  config: { includePatterns: [], excludePatterns: [], allowSubdomains: false, keepQueryStrings: false,
    respectRobots: true, respectCrawlDelay: true, discoverSitemaps: true, followNofollow: false },
};
const dependencies = (): CrawlResultsDependencies => ({
  captureArtifact: vi.fn(), downloadArtifact: vi.fn(), exportPdf: vi.fn(), copyText: vi.fn(),
});
const setup = (services: CrawlResultsDependencies) => renderHook(() => useCrawlResultsSession({
  result, runs: [run], selectedRun: run, onSelectRun: vi.fn(),
}, services));
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: null }); });

it('recovers corrupted navigation independently and derives the correct group', () => {
  expect(readCrawlNavigationPreferences(null).activeTab).toBe('overview');
  localStorage.setItem('nav', '{');
  expect(readCrawlNavigationPreferences('nav').activeTab).toBe('overview');
  localStorage.setItem('nav', JSON.stringify({ activeTab: 'exports', activeTabGroup: 'core', validationQuery: 'x'.repeat(200), validationSeverity: 'Error' }));
  expect(readCrawlNavigationPreferences('nav')).toMatchObject({ activeTab: 'exports', activeTabGroup: 'export', validationSeverity: 'Error' });
  expect(readCrawlNavigationPreferences('nav').validationQuery).toHaveLength(120);
});

it('bounds link preferences and recovers invalid enums without coercion', () => {
  localStorage.setItem('links', JSON.stringify({ query: 'x'.repeat(200), kind: 1, status: 'unknown', sort: 'target', descending: 'true' }));
  expect(readCrawlLinkNavigationPreferences('links')).toEqual({ query: 'x'.repeat(160), kind: 'all', status: 'all', sort: 'target', descending: false });
  expect(readCrawlLinkNavigationPreferences(null).query).toBe('');
  expect(normalizeLinkUrl('https://example.com/a#fragment')).toBe('https://example.com/a');
  expect(normalizeLinkUrl(' invalid ')).toBe('invalid');
  expect(loadFilterPresets('empty')).toEqual([]);
});

it('contains rendering failures and always releases the busy state', async () => {
  const services = dependencies(); vi.mocked(services.captureArtifact).mockRejectedValue(new Error('capture failed'));
  const hook = setup(services);
  await act(() => hook.result.current.createRenderedArtifact('screenshot'));
  expect(hook.result.current.renderedArtifactError).toBe('capture failed');
  expect(hook.result.current.renderedArtifactKind).toBeNull();
  expect(services.downloadArtifact).not.toHaveBeenCalled();
});

it('passes render scope to injected transport and downloads only successful captures', async () => {
  const services = dependencies();
  const artifact = { requestedUrl: result.start_url, finalUrl: result.start_url, capturedAt: run.completedAt,
    artifactType: 'pdf' as const, contentType: 'application/pdf', fileName: 'test.pdf', bytes: 0, dataBase64: '', rendererPlatform: 'test' };
  vi.mocked(services.captureArtifact).mockResolvedValue(artifact);
  const hook = setup(services);
  await act(() => hook.result.current.createRenderedArtifact('pdf'));
  expect(services.captureArtifact).toHaveBeenCalledWith(expect.objectContaining({ url: result.start_url, runId: run.id, kind: 'pdf', allowSubdomains: false }));
  expect(services.downloadArtifact).toHaveBeenCalledWith(artifact);
  expect(hook.result.current.renderedArtifact).toEqual(artifact);
});

it('preserves the PDF error and does not show successful copy when clipboard rejects', async () => {
  const services = dependencies(); vi.mocked(services.exportPdf).mockRejectedValue(new Error('export failed'));
  vi.mocked(services.copyText).mockResolvedValue(false);
  const hook = setup(services);
  await act(() => hook.result.current.exportPdf());
  await act(() => hook.result.current.copyLinkSource('link', 'source'));
  expect(hook.result.current.pdfError).toBe('export failed');
  expect(hook.result.current.copiedLinkSourceKey).toBeNull();
});
