import { afterEach, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { filterHook, filterVerdict } from './fixtures/crawlFilterHook';
import { deferred } from './fixtures/gscSliceDirect';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import type { CrawlFilterValidationResult } from '@/types';
import i18n from '@/i18n';

afterEach(cleanup);

it('deduplicates preview URLs in source order, uses final URL and caps at 500', async () => {
  const fixture = filterHook();
  act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig, seedUrls: ['https://example.test', '', 'https://seed.test'], includePatterns: ['/shop'], excludePatterns: ['/private'] }, crawlResult: createCrawlResultFixture({ sitemap_urls: ['https://seed.test', 'https://sitemap.test'], pages: [createCrawlPageFixture({ final_url: 'https://final.test' }), createCrawlPageFixture({ url: 'https://fallback.test', final_url: '' })] }) }));
  fixture.services.invoke.mockResolvedValue(filterVerdict());
  await act(async () => expect(await fixture.result.current.validateFilters()).toEqual(filterVerdict()));
  expect(fixture.services.invoke).toHaveBeenCalledWith('validate_crawl_filters', { includePatterns: ['/shop'], excludePatterns: ['/private'], previewUrls: ['https://example.test', 'https://seed.test', 'https://sitemap.test', 'https://final.test', 'https://fallback.test'] });
  act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig, seedUrls: Array.from({ length: 600 }, (_, i) => `https://example.test/${i}`) } }));
  expect(fixture.result.current.filterValidation).toBeNull();
  await act(async () => fixture.result.current.validateFilters());
  const preview = fixture.services.invoke.mock.lastCall?.[1].previewUrls;
  expect(preview).toHaveLength(500);
  expect(preview[0]).toBe('https://example.test');
  expect(preview[499]).toBe('https://example.test/498');
});

it.each([new Error('Current failure'), 'unknown failure'])('reports current errors without accepting a valid verdict: %s', async (error) => {
  const fixture = filterHook();
  fixture.services.invoke.mockRejectedValue(error);
  await act(async () => expect(await fixture.result.current.validateFilters()).toBeNull());
  expect(fixture.result.current).toMatchObject({ filterValidation: null, isCheckingFilters: false, filterValidationError: error instanceof Error ? error.message : i18n.t('siteAudit.filterCheckError') });
});

it.each(['url', 'patterns', 'preview', 'unmount'] as const)('invalidates a pending verdict on %s change', async (kind) => {
  const fixture = filterHook();
  const pendingResult = deferred<CrawlFilterValidationResult>();
  fixture.services.invoke.mockReturnValue(pendingResult.promise);
  let pending!: Promise<CrawlFilterValidationResult | null>;
  act(() => { pending = fixture.result.current.validateFilters(); });
  if (kind === 'url') fixture.rerender({ project: 'one', url: 'https://new.test' });
  else if (kind === 'patterns') act(() => useToolsStore.setState({ crawlConfig: { ...useToolsStore.getState().crawlConfig, excludePatterns: ['/new'] } }));
  else if (kind === 'preview') act(() => useToolsStore.setState({ crawlResult: createCrawlResultFixture({ sitemap_urls: ['https://new.test'] }) }));
  else fixture.unmount();
  await act(async () => { pendingResult.resolve(filterVerdict()); expect(await pending).toBeNull(); });
  if (kind !== 'unmount') expect(fixture.result.current).toMatchObject({ filterValidation: null, filterValidationError: null, isCheckingFilters: false });
});

it('normalizes exclude patterns and resets severity/kind only when the project changes', () => {
  const fixture = filterHook();
  act(() => fixture.result.current.setSeverityFilter('Warning'));
  act(() => fixture.result.current.setErrorKindFilter('missing'));
  act(() => fixture.result.current.setFilterPatterns('excludePatterns', ' \n /one \n /two '));
  expect(fixture.setCrawlConfig).toHaveBeenCalledWith({ excludePatterns: ['/one', '/two'] });
  expect(fixture.result.current).toMatchObject({ severityFilter: 'Warning', errorKindFilter: 'missing', activeErrorKindFilter: 'all' });
  fixture.rerender({ project: 'two', url: 'https://example.test' });
  expect(fixture.result.current).toMatchObject({ severityFilter: 'all', errorKindFilter: 'all', filteredPages: [], filteredResources: [] });
});

it('applies severity and available error kinds to page/resource evidence independently', () => {
  const fixture = filterHook();
  const warning = createCrawlPageFixture({ url: 'https://warning.test', http_status: 404, issues: [{ severity: 'Warning', message: 'Observed warning' }] });
  const critical = createCrawlPageFixture({ url: 'https://critical.test', request_error_kind: 'dns', issues: [{ severity: 'Critical', message: 'Observed critical' }] });
  const healthy = createCrawlPageFixture({ url: 'https://healthy.test' });
  const resource = { url: 'https://image.test', source_urls: [], resource_type: 'image', request_error_kind: 'dns' };
  act(() => useToolsStore.setState({ crawlResult: createCrawlResultFixture({ pages: [warning, critical, healthy], resources: [resource] }) }));
  expect(fixture.result.current.availableErrorKinds).toEqual(['http', 'dns']);
  act(() => fixture.result.current.setSeverityFilter('Warning'));
  expect(fixture.result.current.filteredPages).toEqual([warning]);
  expect(fixture.result.current.filteredResources).toEqual([resource]);
  act(() => fixture.result.current.setErrorKindFilter('dns'));
  expect(fixture.result.current.filteredPages).toEqual([]);
  expect(fixture.result.current.filteredResources).toEqual([resource]);
  act(() => fixture.result.current.setSeverityFilter('all'));
  expect(fixture.result.current.filteredPages).toEqual([critical]);
  act(() => fixture.result.current.setErrorKindFilter('unknown'));
  expect(fixture.result.current.activeErrorKindFilter).toBe('all');
  expect(fixture.result.current.filteredPages).toEqual([warning, critical, healthy]);
});
