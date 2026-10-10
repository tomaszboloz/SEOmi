import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const initialTools = useToolsStore.getState();
const initialProjects = useProjectStore.getState();

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'session-coverage' });
  useToolsStore.setState({ crawlRuns: [], crawlResult: null, crawlRequestProfiles: [] });
});

afterEach(() => {
  useToolsStore.setState(initialTools);
  useProjectStore.setState(initialProjects);
});

describe('useSiteAuditSession coverage edges', () => {
  it('instantiates cleanly with default services and null crawlResult', () => {
    const { result } = renderHook(() => useSiteAuditSession());
    expect(result.current.sitemapOnlyUrls).toEqual([]);
    expect(result.current.crawlOnlyUrls).toEqual([]);
    expect(result.current.renderedProfileHasTransportOverrides).toBe(false);
  });

  it('searches profiles and evaluates transport overrides for headers and proxy', () => {
    act(() => {
      useToolsStore.setState({
        crawlRequestProfiles: [
          { id: 'p1', name: 'P1', hasHeaders: true, hasProxy: false } as any,
          { id: 'p2', name: 'P2', hasHeaders: false, hasProxy: true } as any,
          { id: 'p3', name: 'P3', hasHeaders: false, hasProxy: false } as any,
        ],
        crawlConfig: { ...useToolsStore.getState().crawlConfig, requestProfileId: 'p2' },
      });
    });

    const { result, rerender } = renderHook(() => useSiteAuditSession());
    expect(result.current.renderedProfileHasTransportOverrides).toBe(true);

    act(() => {
      useToolsStore.setState({
        crawlConfig: { ...useToolsStore.getState().crawlConfig, requestProfileId: 'p1' },
      });
    });
    rerender();
    expect(result.current.renderedProfileHasTransportOverrides).toBe(true);

    act(() => {
      useToolsStore.setState({
        crawlConfig: { ...useToolsStore.getState().crawlConfig, requestProfileId: 'p3' },
      });
    });
    rerender();
    expect(result.current.renderedProfileHasTransportOverrides).toBe(false);

    act(() => {
      useToolsStore.setState({
        crawlConfig: { ...useToolsStore.getState().crawlConfig, requestProfileId: 'nonexistent' },
      });
    });
    rerender();
    expect(result.current.renderedProfileHasTransportOverrides).toBe(false);
  });

  it('evaluates final_url equality, history metrics callbacks, and environment labels', () => {
    act(() => {
      useToolsStore.setState({
        crawlResult: createCrawlResultFixture({
          sitemap_urls: ['https://example.test/sitemap-target', 'https://example.test/orphan'],
          pages: [
            createCrawlPageFixture({ url: 'https://example.test/origin', final_url: 'https://example.test/sitemap-target' }),
            createCrawlPageFixture({ url: 'https://example.test/extra', final_url: 'https://example.test/extra' }),
          ],
        }),
        crawlRuns: [
          createCrawlRunFixture({
            id: 'run-1',
            result: createCrawlResultFixture({
              pages_crawled: Number.POSITIVE_INFINITY,
              critical_count: 0,
              pages: [
                createCrawlPageFixture({ http_status: 200, indexability_status: 'Eligible from this response only', word_count: 15 }),
                createCrawlPageFixture({ http_status: 301, indexability_status: 'Blocked', word_count: 5 }),
                createCrawlPageFixture({ http_status: 100, indexability_status: 'Blocked', word_count: 0 }),
              ],
            }),
          }),
        ],
      });
    });

    const { result } = renderHook(() => useSiteAuditSession());
    expect(result.current.sitemapOnlyUrls).toEqual(['https://example.test/orphan']);
    expect(result.current.crawlOnlyUrls).toEqual(['https://example.test/origin', 'https://example.test/extra']);
    expect(result.current.crawlEnvironmentLabel('staging')).toBe(i18n.t('siteAudit.environmentStaging'));
    expect(result.current.crawlEnvironmentLabel('production')).toBe(i18n.t('siteAudit.environmentProduction'));
    expect(result.current.crawlEnvironmentLabel(undefined)).toBe(i18n.t('siteAudit.environmentStandard'));
    expect(result.current.crawlEnvironmentLabel('other' as any)).toBe(i18n.t('siteAudit.environmentStandard'));
    expect(result.current.historyMetrics[0].values).toEqual([null]);
    expect(result.current.historyMetrics[3].values).toEqual([1]);
    expect(result.current.historyMetrics[4].values).toEqual([1]);
    expect(result.current.historyMetrics[5].values).toEqual([20]);
  });
});
