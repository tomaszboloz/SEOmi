import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const tools = useToolsStore.getState();
const projects = useProjectStore.getState();
beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); useProjectStore.setState({ activeProjectId: 'derived' }); });
afterEach(() => { useToolsStore.setState(tools); useProjectStore.setState(projects); });

it('derives history metrics in chronological order from stored runs', () => {
  const newest = createCrawlRunFixture({ id: 'b', result: createCrawlResultFixture({ pages_crawled: 2, critical_count: 1, warning_count: 3,
    pages: [createCrawlPageFixture({ word_count: 10 }), createCrawlPageFixture({ http_status: 404, indexability_status: 'Blocked', word_count: 5 })] }) });
  const oldest = createCrawlRunFixture({ id: 'a', result: createCrawlResultFixture({ pages_crawled: Number.NaN, pages: [] }) });
  useToolsStore.setState({ crawlRuns: [newest, oldest] });
  const { result } = renderHook(() => useSiteAuditSession());
  const byLabel = Object.fromEntries(result.current.historyMetrics.map((m) => [m.label, m.values]));
  expect(byLabel[i18n.t('siteAudit.processedUrls')]).toEqual([null, 2]);
  expect(byLabel[i18n.t('siteAudit.criticalErrors')]).toEqual([0, 1]);
  expect(byLabel[i18n.t('siteAudit.warnings')]).toEqual([0, 3]);
  expect(byLabel[i18n.t('siteAudit.statuses2xx')]).toEqual([0, 1]);
  expect(byLabel[i18n.t('siteAudit.indexableResponses')]).toEqual([0, 1]);
  expect(byLabel[i18n.t('siteAudit.contentWords')]).toEqual([0, 15]);
});

it('labels crawl environments and splits sitemap-only from crawl-only urls', () => {
  useToolsStore.setState({ crawlResult: createCrawlResultFixture({ sitemap_urls: ['https://example.test/', 'https://example.test/s'],
    pages: [createCrawlPageFixture(), createCrawlPageFixture({ url: 'https://example.test/c', final_url: 'https://example.test/c' })] }) });
  const { result } = renderHook(() => useSiteAuditSession());
  const label = result.current.crawlEnvironmentLabel;
  expect(label('staging')).toBe(i18n.t('siteAudit.environmentStaging'));
  expect(label('production')).toBe(i18n.t('siteAudit.environmentProduction'));
  expect(label(undefined)).toBe(i18n.t('siteAudit.environmentStandard'));
  expect(result.current.sitemapOnlyUrls).toEqual(['https://example.test/s']);
  expect(result.current.crawlOnlyUrls).toEqual(['https://example.test/c']);
});
