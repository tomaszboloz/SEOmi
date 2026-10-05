import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useCrawlResultsSession, type CrawlResultsDependencies } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import { useProjectStore } from '@/stores/projectStore';
import type { CrawlRunRecord, SiteCrawlResult } from '@/types';

const mkResult = (urls: string[], sitemap: string[] = []) => ({ start_url: 'https://a.test/', pages: urls.map((url) => ({ url, final_url: url, issues: [], links: [], images: [], hreflangs: [], schema_types: [], schema_syntax_errors: 0, redirect_chain: [], depth: 0, response_time_ms: 1 })), sitemap_urls: sitemap, resources: [] }) as unknown as SiteCrawlResult;
const mkRun = (id: string, result: SiteCrawlResult) => ({ id, completedAt: '2026-01-01T00:00:00Z', startUrl: result.start_url, result, config: {} }) as unknown as CrawlRunRecord;
const result = mkResult(['https://a.test/', 'https://a.test/b'], ['https://a.test/', 'https://a.test/only-sitemap']);
const runA = mkRun('run-a', result);
const older = mkRun('run-old', mkResult(['https://a.test/']));
const deps = (): CrawlResultsDependencies => ({ captureArtifact: vi.fn(), downloadArtifact: vi.fn(), exportPdf: vi.fn(), copyText: vi.fn() });
const setup = (props: Partial<Parameters<typeof useCrawlResultsSession>[0]> = {}, services = deps()) =>
  renderHook(() => useCrawlResultsSession({ result, runs: [runA, older], selectedRun: runA, onSelectRun: vi.fn(), ...props } as never, services));

describe('useCrawlResultsSession', () => {
  beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); useProjectStore.setState({ activeProjectId: 'proj' } as never); });
  afterEach(() => vi.restoreAllMocks());

  it('derives the navigation run id from selection, matching run or a default', () => {
    expect(setup().result.current.navigationRunId).toBe('run-a');
    expect(setup({ selectedRun: undefined }).result.current.navigationRunId).toBe('run-a');
    expect(setup({ selectedRun: undefined, runs: [] }).result.current.navigationRunId).toBe('current');
    expect(setup().result.current.currentRun).toBe(runA);
    expect(setup({ selectedRun: undefined, runs: [] }).result.current.currentRun).toBeUndefined();
  });

  it('counts sitemap-only and crawl-only urls and exposes labelled metadata', () => {
    const { result: r } = setup();
    expect(r.current.sitemapOnlyCount).toBe(1);
    expect(r.current.crawlOnlyCount).toBe(1);
    expect(r.current.activeTabMeta).toBeTruthy();
    expect(r.current.activeGroupMeta).toBeTruthy();
    expect(r.current.localizedTabLabel(r.current.activeTabMeta)).toBe(i18n.t(`crawl.${r.current.activeTabMeta.labelKey}`));
  });

  it('localizes group and facet labels through crawl translation keys', () => {
    const { result: r } = setup();
    expect(r.current.localizedGroupLabel({ labelKey: 'ui.status' })).toBe(i18n.t('crawl.ui.status'));
    expect(r.current.localizedGroupShortLabel({ shortLabelKey: 'ui.depth' })).toBe(i18n.t('crawl.ui.depth'));
    expect(r.current.localizedFacetLabel({ labelKey: 'x' })).toBe(i18n.t('crawl.metadataFacets.x'));
    expect(r.current.localizedFacetDescription({ descriptionKey: 'y' })).toBe(i18n.t('crawl.metadataFacets.y'));
  });

  it('builds evidence deep links with and without project and run', () => {
    const { result: r } = setup();
    const href = r.current.evidenceHref('https://a.test/b');
    expect(new URLSearchParams(href.split('?')[1]).get('project')).toBe('proj');
    expect(new URLSearchParams(href.split('?')[1]).get('run')).toBe('run-a');
    const link = new URLSearchParams(r.current.linkEvidenceHref('s', 't').split('?')[1]);
    expect([link.get('tab'), link.get('source'), link.get('target'), link.get('url')]).toEqual(['links', 's', 't', 's']);
    useProjectStore.setState({ activeProjectId: null } as never);
    const bare = setup({ selectedRun: undefined, runs: [] });
    expect(new URLSearchParams(bare.result.current.evidenceHref('u').split('?')[1]).get('project')).toBe('');
    expect(new URLSearchParams(bare.result.current.linkEvidenceHref('s', 't').split('?')[1]).get('run')).toBe('');
  });

  it('persists navigation and link filters per project and run', async () => {
    const { result: r } = setup();
    act(() => { r.current.setValidationQuery('x'.repeat(300)); r.current.setLinkQuery('y'.repeat(300)); r.current.setLinkDescending(true); });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('seomi_project_proj_crawl_links_run-a_v1') as string).query).toHaveLength(160));
    expect(JSON.parse(localStorage.getItem('seomi_project_proj_crawl_links_run-a_v1') as string).descending).toBe(true);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('seomi_project_proj_crawl_navigation_run-a_v1') as string).validationQuery).toHaveLength(120));
  });

  it('does not persist anything without an active project', () => {
    useProjectStore.setState({ activeProjectId: null } as never);
    const { result: r } = setup();
    act(() => r.current.setLinkQuery('q'));
    expect(localStorage.length).toBe(0);
  });

  it('compares with another run but never with the current one', () => {
    const { result: r } = setup();
    expect(r.current.comparison).toBeNull();
    act(() => r.current.setComparisonRunId('run-a'));
    expect(r.current.comparison).toBeNull();
    act(() => r.current.setComparisonRunId('run-old'));
    expect(r.current.comparison).not.toBeNull();
    act(() => r.current.setComparisonRunId('missing'));
    expect(r.current.comparison).toBeNull();
  });

  it('deletes the current run only after confirmation', async () => {
    const onDeleteRun = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { result: r } = setup({ onDeleteRun });
    await act(() => r.current.deleteCurrentRun());
    expect(confirm).toHaveBeenCalledWith(i18n.t('crawl.ui.deleteRunConfirm'));
    expect(onDeleteRun).not.toHaveBeenCalled();
    await act(() => r.current.deleteCurrentRun());
    expect(onDeleteRun).toHaveBeenCalledWith('run-a');
  });

  it('skips deletion without a handler or a current run', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const noHandler = setup();
    await act(() => noHandler.result.current.deleteCurrentRun());
    const onDeleteRun = vi.fn();
    const noRun = setup({ selectedRun: undefined, runs: [], onDeleteRun });
    await act(() => noRun.result.current.deleteCurrentRun());
    expect(confirm).not.toHaveBeenCalled();
    expect(onDeleteRun).not.toHaveBeenCalled();
  });

  it('flashes the copied link key after a successful copy', async () => {
    const services = deps();
    vi.mocked(services.copyText).mockResolvedValue(true);
    const { result: r } = setup({}, services);
    await act(() => r.current.copyLinkSource('k1', 'https://src'));
    expect(services.copyText).toHaveBeenCalledWith('https://src');
    expect(r.current.copiedLinkSourceKey).toBe('k1');
  });
});
