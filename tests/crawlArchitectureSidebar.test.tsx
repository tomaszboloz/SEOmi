import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CrawlArchitectureSidebar } from '@/components/Charts/crawlArchitecture/CrawlArchitectureSidebar';
import i18n from '@/i18n';

const t = (k: string, o?: object): string => String(i18n.t(k, o as never));
const page = (patch: Record<string, unknown> = {}) => ({
  url: 'https://a.test/one?x=1', title: 'Page One', semantic_content_source: 'primary-root',
  semantic_content_provenance: 'http', ...patch,
});
const node = (patch: Record<string, unknown> = {}, pagePatch: Record<string, unknown> = {}) => ({
  page: page(pagePatch), clusterLabel: 'Topic A', semanticSignalCount: 3,
  incomingContentLinks: 2, orphan: false, ...patch,
});
const baseProps = (over: Record<string, unknown> = {}) => ({
  graph: { clusters: [{ id: 'c1', label: 'Alpha', pageCount: 4 }] },
  selectedNode: node(), selectedId: 'n1', selectedTopicEdges: [], selectedOutboundEdges: [],
  nodeById: new Map(), linkMode: 'content', crawlMode: 'http', ...over,
});
const show = (over: Record<string, unknown> = {}) => render(<CrawlArchitectureSidebar {...baseProps(over)} />);

describe('CrawlArchitectureSidebar', () => {
  beforeEach(() => i18n.changeLanguage('en'));

  it('shows the cluster legend, capped at twelve with an overflow counter', () => {
    const clusters = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, label: `Cluster${i}`, pageCount: i }));
    show({ graph: { clusters }, selectedNode: null });
    expect(screen.getByText(/Cluster0/)).toBeTruthy();
    expect(screen.getByText(/Cluster11/)).toBeTruthy();
    expect(screen.queryByText(/Cluster12/)).toBeNull();
    expect(screen.getByText(t('mapUi.moreClusters', { count: 2 }))).toBeTruthy();
  });

  it('shows a hint tied to the link mode when nothing is selected', () => {
    const { unmount } = show({ selectedNode: null, linkMode: 'all' });
    expect(screen.getByText(t('mapUi.selectNodeHint', { label: t('mapUi.internalLinks') }))).toBeTruthy();
    unmount();
    show({ selectedNode: null });
    expect(screen.getByText(t('mapUi.selectNodeHint', { label: t('mapUi.contentLinks') }))).toBeTruthy();
  });

  it('describes the selected page with title, link, topic and incoming links', () => {
    show({ linkMode: 'all' });
    expect(screen.getByText('Page One')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://a.test/one?x=1');
    expect(screen.getByText(new RegExp(`${t('mapUi.topicLabel')}: Topic A`))).toBeTruthy();
    expect(screen.getByText(t('mapUi.incomingLinks', { count: 2, label: t('mapUi.internalLinks') }))).toBeTruthy();
    expect(screen.queryByText(t('mapUi.source.partial'), { exact: false })).toBeNull();
  });

  it('falls back to the short URL when the page has no title', () => {
    show({ selectedNode: node({}, { title: '' }) });
    expect(screen.getByText('/one?x=1', { selector: 'p' })).toBeTruthy();
  });

  it.each([1, 2, 5, 12, 22])('uses the right plural form for %i terms', (n) => {
    show({ selectedNode: node({ semanticSignalCount: n }) });
    const form = n === 1 ? 'one' : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'few' : 'many';
    expect(screen.getByText(t(`mapUi.plural.term.${form}`, { count: n }))).toBeTruthy();
  });

  it.each([
    ['primary-root', 'rendered', 'mapUi.source.primary', 'mapUi.source.browser'],
    ['body-fallback', 'browser-rendered', 'mapUi.source.fallback', 'mapUi.source.browser'],
    ['unavailable', undefined, 'mapUi.unavailable', 'mapUi.unavailable'],
    [undefined, 'http', 'mapUi.unavailable', 'mapUi.source.http'],
    ['primary-root', 'weird', 'mapUi.source.primary', 'mapUi.unavailable'],
  ])('labels content source %s / provenance %s', (source, provenance, regionKey, provKey) => {
    show({ selectedNode: node({}, { semantic_content_source: source, semantic_content_provenance: provenance }), crawlMode: 'unavailable' });
    const spans = screen.getByText(t('mapUi.contentSource'), { exact: false }).querySelectorAll('span');
    expect(spans[0].textContent).toBe(t(regionKey));
    expect(spans[1].textContent).toBe(t(provKey));
  });

  it('derives provenance from the crawl mode when the page has none and flags partial content', () => {
    show({
      selectedNode: node({}, { semantic_content_provenance: undefined, semantic_content_partial: true }),
      crawlMode: 'rendered',
    });
    const para = screen.getByText(t('mapUi.source.partial'), { exact: false }).closest('p')!;
    expect(para.textContent).toContain(t('mapUi.source.browser'));
  });

  it('lists similar pages with similarity, shared terms and unresolved ids', () => {
    const related = { page: page({ url: 'https://a.test/two' }) };
    show({
      selectedTopicEdges: [
        { id: 'e1', source: 'n1', target: 'n2', weightedJaccard: 0.456, sharedTerms: ['seo', 'audit'] },
        { id: 'e2', source: 'n3', target: 'n1', weightedJaccard: 0.1, sharedTerms: [] },
      ],
      nodeById: new Map([['n2', related]]),
    });
    expect(screen.getByText(t('mapUi.similarityNotLink'))).toBeTruthy();
    const rows = screen.getByText(t('mapUi.similarityNotLink')).parentElement!.querySelectorAll('p.break-all');
    expect(rows[0].textContent).toBe(`/two · 46% · ${t('mapUi.sharedTerms')}: seo, audit`);
    expect(rows[1].textContent).toBe(`n3 · 10% · ${t('mapUi.sharedTerms')}: —`);
  });

  it('lists outbound content links with anchors and counts', () => {
    show({
      selectedOutboundEdges: [
        { id: 'o1', target: 'n2', anchors: ['read', 'more'], links: 2 },
        { id: 'o2', target: 'missing', anchors: [], links: 1 },
      ],
      nodeById: new Map([['n2', { page: page({ url: 'https://a.test/two' }) }]]),
    });
    const rows = screen.getByText(t('mapUi.contentLinksTitle')).parentElement!.querySelectorAll('p.break-all');
    expect(rows[0].textContent).toBe('/two · „read”, „more” · 2×');
    expect(rows[1].textContent).toBe('missing · 1×');
    expect(screen.getByText(t('mapUi.outgoingLinks', { count: 2 }), { exact: false })).toBeTruthy();
  });

  it('shows at most three discovery sources with their details', () => {
    const discovery_sources = [
      { kind: 'start' },
      { kind: 'link', source_url: 'https://a.test/src', anchor_text: 'Go' },
      { kind: 'sitemap', source_url: 'https://a.test/sitemap.xml' },
      { kind: 'seed' },
    ];
    show({ selectedNode: node({}, { discovery_sources }) });
    const rows = screen.getByText(t('mapUi.urlDiscovery')).parentElement!.querySelectorAll('p.break-all');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toBe(t('mapUi.discovery.start'));
    expect(rows[1].textContent).toBe(`${t('mapUi.discovery.link')} · /src · „Go”`);
    expect(rows[2].textContent).toBe(`${t('mapUi.discovery.sitemap')} · /sitemap.xml`);
  });

  it('warns about orphan pages with the link-mode specific noun', () => {
    const { unmount } = show({ selectedNode: node({ orphan: true }), linkMode: 'all' });
    expect(screen.getByText(t('mapUi.noIncoming', { label: t('mapUi.internalLink') }))).toBeTruthy();
    unmount();
    show({ selectedNode: node({ orphan: true }) });
    expect(screen.getByText(t('mapUi.noIncoming', { label: t('mapUi.contentLink') }))).toBeTruthy();
  });

  it('omits optional sections for a page without edges, discovery or orphan flag', () => {
    show();
    expect(screen.queryByText(t('mapUi.similarityNotLink'))).toBeNull();
    expect(screen.queryByText(t('mapUi.contentLinksTitle'))).toBeNull();
    expect(screen.queryByText(t('mapUi.urlDiscovery'))).toBeNull();
  });
});
