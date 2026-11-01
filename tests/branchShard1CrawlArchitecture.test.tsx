import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureControls } from '@/components/Charts/crawlArchitecture/CrawlArchitectureControls';
import type { SemanticMapPreferences } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';
import { useCrawlArchitectureState } from '@/components/Charts/crawlArchitecture/useCrawlArchitectureState';
import { GraphEvidencePanel } from '@/components/Charts/crawlArchitecture/GraphEvidencePanel';
import type { TopicalDiagnosisReport } from '@/services/topicalDiagnosis';
import type { GscPerformanceData } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlPageFixture } from './fixtures/crawl';

const pageRank = vi.hoisted(() => ({ converged: true }));
vi.mock('@/services/semanticGraph/pageRank', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/semanticGraph/pageRank')>();
  return {
    ...original,
    calculatePageRank: (...args: Parameters<typeof original.calculatePageRank>) => ({ ...original.calculatePageRank(...args), converged: pageRank.converged }),
  };
});

const link = (target: string) => ({ target_url: target, anchor_text: 'read', is_internal: true });
const hubPage = createCrawlPageFixture({
  url: 'https://site.test/blog/', final_url: 'https://site.test/blog/', title: 'Blog', word_count: 60,
  semantic_terms: ['blog'], semantic_links: [1, 2, 3, 4, 5, 6].map((index) => link(`https://site.test/blog/post-${index}`)),
});
const posts = [1, 2, 3, 4, 5, 6].map((index) => createCrawlPageFixture({
  url: `https://site.test/blog/post-${index}`, final_url: `https://site.test/blog/post-${index}`, title: `Coffee brewing guide ${index}`, word_count: 500,
  semantic_terms: ['coffee', 'brewing', 'grinder'], semantic_links: [],
}));
const outsider = createCrawlPageFixture({
  url: 'https://site.test/shop/tea', final_url: 'https://site.test/shop/tea', title: 'Tea shop', word_count: 400,
  semantic_terms: ['tea'], semantic_links: [],
});
const pages = [hubPage, ...posts, outsider];
const props = { pages, startUrl: hubPage.url, runId: 'shard1-run' };

describe('useCrawlArchitectureState diagnosis scoping', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useProjectStore.setState({ activeProjectId: 'shard1-arch' });
      useToolsStore.setState({ selectedCrawlRunId: null });
    });
  });
  afterEach(() => cleanup());

  it('restricts the graph to an area including its hub and opens the graph view', () => {
    const { result } = renderHook(() => useCrawlArchitectureState(props));
    const area = result.current.diagnosis.areas.find((candidate) => candidate.hubId);
    expect(area).toBeDefined();
    act(() => result.current.setActiveView('directory'));
    act(() => result.current.setDiagnosisFilter({ kind: 'area', id: area!.id }));
    expect(result.current.activeView).toBe('graph');
    expect(result.current.diagnosisFilterUrls?.has('https://site.test/blog')).toBe(true);
    const urls = result.current.visibleNodes.map((node) => node.page.url);
    expect(urls).toContain(hubPage.url);
    expect(urls).toContain(posts[0].url);
    expect(urls).not.toContain(outsider.url);
  });

  it('restricts the graph to a topic and keeps the active view when the restriction is lifted', () => {
    const { result } = renderHook(() => useCrawlArchitectureState(props));
    const topic = result.current.diagnosis.topics[0];
    act(() => result.current.setDiagnosisFilter({ kind: 'topic', id: topic.id }));
    const topicUrls = result.current.visibleNodes.map((node) => node.page.url);
    expect(topicUrls).toContain(posts[0].url);
    expect(topicUrls).not.toContain(outsider.url);
    act(() => result.current.setActiveView('directory'));
    act(() => result.current.setDiagnosisFilter(null));
    expect(result.current.activeView).toBe('directory');
    expect(result.current.diagnosisFilterUrls).toBeNull();
    expect(result.current.visibleNodes.map((node) => node.page.url)).toContain(outsider.url);
  });

  it('ignores a filter whose scope no longer exists', () => {
    const { result } = renderHook(() => useCrawlArchitectureState(props));
    act(() => result.current.setDiagnosisFilter({ kind: 'topic', id: 'topic-missing' }));
    expect(result.current.diagnosisFilterUrls).toBeNull();
  });
});

describe('CrawlArchitectureControls fallback scope labels', () => {
  const diagnosis = {
    areas: [{ id: 'area-none', label: '', documentIds: [] }],
    topics: [{ id: 'topic-0', label: '', documentIds: [] }],
  } as unknown as TopicalDiagnosisReport;
  const preferences = (diagnosisFilter: SemanticMapPreferences['diagnosisFilter']) =>
    ({ query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content', diagnosisFilter }) as SemanticMapPreferences;
  const renderControls = (diagnosisFilter: SemanticMapPreferences['diagnosisFilter']) => render(
    <CrawlArchitectureControls preferences={preferences(diagnosisFilter)} setPreferences={vi.fn()} graph={{ clusters: [] }} scaleView={vi.fn()} resetView={vi.fn()} diagnosis={diagnosis} />,
  );

  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('names an unlabeled area with the no-hub label', () => {
    renderControls({ kind: 'area', id: 'area-none' });
    expect(screen.getByText(i18n.t('mapUi.diagnosisFilter', { label: i18n.t('topicalDiagnosis.areas.noHub') }))).toBeTruthy();
  });

  it.each([['area' as const], ['topic' as const]])('renders no scope chip for a missing %s', (kind) => {
    renderControls({ kind, id: 'missing' });
    expect(screen.queryByText(i18n.t('mapUi.diagnosisFilter', { label: i18n.t('topicalDiagnosis.areas.noHub') }))).toBeNull();
    expect(screen.queryByText(i18n.t('mapUi.diagnosisFilter', { label: i18n.t('topicalDiagnosis.topics.noLabel') }))).toBeNull();
  });

  it('names an unlabeled topic with the no-label text', () => {
    renderControls({ kind: 'topic', id: 'topic-0' });
    expect(screen.getByText(i18n.t('mapUi.diagnosisFilter', { label: i18n.t('topicalDiagnosis.topics.noLabel') }))).toBeTruthy();
  });
});

describe('GraphEvidencePanel boundaries', () => {
  const graph = {
    nodes: [0, 1].map((index) => ({ id: `page-${index}`, page: { url: `https://example.com/${index}` }, clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 1, incomingContentLinks: index, orphan: index === 0 })),
    edges: [{ id: 'e', source: 'page-0', target: 'page-1', anchors: [], links: 1 }],
    topicEdges: [], clusters: [], hasSemanticTerms: true, totalEdges: 1, totalTopicEdges: 0, totalInternalLinks: 1, truncated: false,
  };
  const gsc = (): GscPerformanceData => ({
    site_url: 'sc-domain:example.com', start_date: '2026-09-01', end_date: '2026-09-30', filters: {}, pages: [], queries: [], total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0,
  } as unknown as GscPerformanceData);

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    pageRank.converged = true;
    useProjectStore.setState({ activeProjectId: 'shard1-evidence' });
    useToolsStore.setState({ gscProperty: 'sc-domain:example.com', gscFilters: {}, gscData: null });
  });
  afterEach(() => cleanup());

  it('labels a PageRank run that hit the iteration bound', () => {
    pageRank.converged = false;
    render(<GraphEvidencePanel graph={graph as never} />);
    expect(screen.getByText(i18n.t('sprsUi.notConverged'))).toBeTruthy();
  });

  it('shows a placeholder for the property when the GSC property is invalid', () => {
    useToolsStore.setState({ gscProperty: 'not a property', gscData: gsc() });
    render(<GraphEvidencePanel graph={graph as never} />);
    expect(screen.getByText(i18n.t('mapUi.graphEvidence.status.invalid'))).toBeTruthy();
    const propertyTerm = screen.getByText(i18n.t('mapUi.graphEvidence.property'));
    expect(propertyTerm.nextElementSibling?.textContent).toBe('—');
  });
});
