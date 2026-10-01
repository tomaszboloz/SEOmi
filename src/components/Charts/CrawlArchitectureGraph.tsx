import { z } from 'zod';
import { readJsonRecord, parseRecordEntries } from '@/services/storageContracts';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { drag } from 'd3-drag';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, ListTree, MapPinned, Network } from 'lucide-react';
import { buildSemanticMap, type SemanticPageNode } from '@/services/semanticMap';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import { CrawlDirectoryTree } from '@/components/Charts/CrawlDirectoryTree';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useUIStore } from '@/stores/uiStore';
import type { CrawlRunRecord, CrawledPageSummary } from '@/types';
import { writeJsonStorage } from '@/services/storage';
import { normalizeSemanticText } from '@/services/semanticText';

interface CrawlArchitectureGraphProps { pages: CrawledPageSummary[]; startUrl: string; crawlMode?: string; runId?: string; sitemapUrls?: string[]; runs?: CrawlRunRecord[]; currentRunId?: string; }
interface LayoutPoint { x: number; y: number; }
interface SemanticMapPreferences {
  query: string;
  clusterFilter: string;
  orphansOnly: boolean;
  linkMode: 'content' | 'all';
  selectedUrl: string | null;
  activeView: MapView;
  positions: Record<string, LayoutPoint>;
  transform: { x: number; y: number; k: number };
}

type MapView = 'graph' | 'directory' | 'plan';

const buildMapViewTabs = (translate: (key: string) => string): Array<{ id: MapView; label: string; description: string; icon: typeof Network }> => [
  { id: 'graph', label: translate('mapUi.tabs.graph'), description: translate('mapUi.tabs.graphDescription'), icon: Network },
  { id: 'directory', label: translate('mapUi.tabs.directory'), description: translate('mapUi.tabs.directoryDescription'), icon: ListTree },
  { id: 'plan', label: translate('mapUi.tabs.plan'), description: translate('mapUi.tabs.planDescription'), icon: BarChart3 },
];

const emptyPreferences = (): SemanticMapPreferences => ({ query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content', selectedUrl: null, activeView: 'graph', positions: {}, transform: { x: 0, y: 0, k: 1 } });

const readPreferences = (key: string | null): SemanticMapPreferences => {
  if (!key) return emptyPreferences();
  try {
    const parsed = readJsonRecord(key);
    if (!parsed) return emptyPreferences();
    const positions = Object.fromEntries(Object.entries(parseRecordEntries(parsed.positions, z.object({ x: z.number().finite(), y: z.number().finite() }))).filter(([, point]) =>
      point && Number.isFinite(point.x) && Number.isFinite(point.y),
    ).slice(0, 160));
    return {
      query: typeof parsed.query === 'string' ? parsed.query.slice(0, 200) : '',
      clusterFilter: typeof parsed.clusterFilter === 'string' ? parsed.clusterFilter : 'all',
      orphansOnly: parsed.orphansOnly === true,
      linkMode: parsed.linkMode === 'all' ? 'all' : 'content',
      selectedUrl: typeof parsed.selectedUrl === 'string' ? parsed.selectedUrl : null,
      activeView: parsed.activeView === 'directory' || parsed.activeView === 'plan' ? parsed.activeView : 'graph',
      positions,
      transform: z.object({ x: z.number().finite(), y: z.number().finite(), k: z.number().finite().min(0.2).max(4) }).catch({ x: 0, y: 0, k: 1 }).parse(parsed.transform),
    };
  } catch {
    return emptyPreferences();
  }
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  semanticNode: SemanticPageNode;
  color: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  anchors: string[];
  links: number;
  kind: 'content-link' | 'topic-similarity';
  sharedTerms: string[];
  weightedJaccard: number;
}

const WIDTH = 1120;
const HEIGHT = 620;
const CLUSTER_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#fb7185', '#2dd4bf', '#a3e635', '#f97316', '#818cf8', '#e879f9'];

const shortUrl = (value: string): string => {
  try { const url = new URL(value); return `${url.pathname}${url.search}` || '/'; } catch { return value; }
};

const discoveryLabel = (kind: string, translate: (key: string) => string): string => ({
  start: translate('mapUi.discovery.start'),
  seed: translate('mapUi.discovery.seed'),
  sitemap: translate('mapUi.discovery.sitemap'),
  link: translate('mapUi.discovery.link'),
}[kind] ?? kind);

export const CrawlArchitectureGraph = ({ pages, startUrl, crawlMode = 'http', runId = 'current', sitemapUrls = [], runs = [], currentRunId }: CrawlArchitectureGraphProps) => {
  const { t } = useTranslation();
  const mapViewTabs = buildMapViewTabs(t);
  const markerId = `semantic-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const selectedCrawlRunId = useToolsStore((state) => state.selectedCrawlRunId);
  // The selected run passed by the results workspace is authoritative. The
  // global store can briefly contain the previous run while the controlled
  // results view is hydrating, and using it here would load/save the wrong
  // project's run-specific map preferences.
  const effectiveRunId = currentRunId ?? selectedCrawlRunId ?? runId;
  const storageKey = activeProjectId ? `seomi_project_${activeProjectId}_semantic_map_${effectiveRunId}_v1` : null;
  const [preferences, setPreferences] = useState<SemanticMapPreferences>(() => readPreferences(storageKey));
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey);
  const [activeView, setActiveViewState] = useState<MapView>(() => readPreferences(storageKey).activeView);
  const graph = useMemo(() => buildSemanticMap(pages, startUrl, { includeAllInternalLinks: preferences.linkMode === 'all' }), [pages, preferences.linkMode, startUrl]);
  const contentGraph = useMemo(() => buildSemanticMap(pages, startUrl), [pages, startUrl]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphLayerRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const mapTabsRef = useRef<HTMLDivElement | null>(null);
  const bottomMapTabsRef = useRef<HTMLDivElement | null>(null);
  const { query, clusterFilter, orphansOnly, linkMode } = preferences;
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selectedId = graph.nodes.find((node) => node.page.url === preferences.selectedUrl)?.id ?? null;
  const setSelectedId = (nodeId: string | null) => setPreferences((previous) => ({
    ...previous,
    selectedUrl: nodeId ? nodeById.get(nodeId)?.page.url ?? null : null,
  }));

  useEffect(() => {
    const nextPreferences = readPreferences(storageKey);
    setPreferences(nextPreferences);
    setActiveViewState(nextPreferences.activeView);
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    writeJsonStorage(storageKey, preferences);
  }, [loadedStorageKey, preferences, storageKey]);
  const visibleNodes = useMemo(() => {
    const normalizedQuery = normalizeSemanticText(query);
    return graph.nodes.filter((node) => {
      if (clusterFilter !== 'all' && node.clusterId !== clusterFilter) return false;
      if (orphansOnly && !node.orphan) return false;
      if (!normalizedQuery) return true;
      return normalizeSemanticText([node.page.url, node.page.title ?? '', node.clusterLabel, ...(node.page.semantic_terms ?? [])].join(' '))
        .includes(normalizedQuery);
    });
  }, [clusterFilter, graph.nodes, orphansOnly, query]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph.edges, visibleIds]);
  const visibleTopicEdges = useMemo(() => graph.topicEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph.topicEdges, visibleIds]);
  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedOutboundEdges = useMemo(
    () => selectedId ? graph.edges.filter((edge) => edge.source === selectedId).slice(0, 12) : [],
    [graph.edges, selectedId],
  );
  const selectedTopicEdges = useMemo(
    () => selectedId ? contentGraph.topicEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId).slice(0, 12) : [],
    [contentGraph.topicEdges, selectedId],
  );
  const contentIncoming = graph.totalInternalLinks;
  const semanticSourceCounts = useMemo(() => pages.reduce((counts, page) => {
    const source = page.semantic_content_source || 'unavailable';
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {} as Record<string, number>), [pages]);
  const semanticPartialCount = useMemo(
    () => pages.filter((page) => page.semantic_content_partial === true).length,
    [pages],
  );
  const semanticSourceLabel = crawlMode === 'browser-rendered' ? t('mapUi.source.browser') : t('mapUi.source.http');
  const semanticRegionLabel = (source: string | undefined) => {
    if (source === 'primary-root') return t('mapUi.source.primary');
    if (source === 'body-fallback') return t('mapUi.source.fallback');
    return t('mapUi.unavailable');
  };
  const semanticProvenanceLabel = (provenance: string | undefined, source: string | undefined) => {
    const effective = provenance || (source && source !== 'unavailable' ? crawlMode : 'unavailable');
    if (effective === 'rendered' || effective === 'browser-rendered') return t('mapUi.source.browser');
    if (effective === 'http') return t('mapUi.source.http');
    return t('mapUi.unavailable');
  };
  const localizedPlural = (count: number, key: string) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = count === 1 ? 'one' : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'few' : 'many';
    return t(`mapUi.plural.${key}.${form}`, { count });
  };

  useEffect(() => {
    const svgElement = svgRef.current;
    const graphLayer = graphLayerRef.current;
    if (!svgElement || !graphLayer) return;

    const clusterColors = new Map(graph.clusters.map((cluster, index) => [cluster.id, CLUSTER_COLORS[index % CLUSTER_COLORS.length]]));
    const nodes: SimNode[] = visibleNodes.map((node) => {
      const savedPosition = preferences.positions[node.page.url];
      return {
        id: node.id,
        semanticNode: node,
        color: clusterColors.get(node.clusterId) ?? '#94a3b8',
        x: savedPosition?.x,
        y: savedPosition?.y,
      };
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const links: SimLink[] = visibleEdges.map((edge) => ({
      id: edge.id,
      source: nodeById.get(edge.source)!,
      target: nodeById.get(edge.target)!,
      anchors: edge.anchors,
      links: edge.links,
      kind: 'content-link',
      sharedTerms: [],
      weightedJaccard: 0,
    }));
    const topicLinks: SimLink[] = visibleTopicEdges.map((edge) => ({
      id: edge.id,
      source: nodeById.get(edge.source)!,
      target: nodeById.get(edge.target)!,
      anchors: [],
      links: 0,
      kind: 'topic-similarity',
      sharedTerms: edge.sharedTerms,
      weightedJaccard: edge.weightedJaccard,
    }));

    const root = select(graphLayer);
    const topicElements = root.selectAll<SVGLineElement, SimLink>('line.topic-similarity-edge')
      .data(topicLinks, (edge) => edge.id)
      .join('line')
      .attr('class', 'topic-similarity-edge')
      .attr('stroke', '#38bdf8')
      .attr('stroke-opacity', 0.34)
      .attr('stroke-dasharray', '3 5')
      .attr('stroke-width', (edge) => 0.8 + Math.min(edge.weightedJaccard * 2, 1.2))
      .attr('aria-label', (edge) => t('mapUi.edgeSimilarityAria', { percent: Math.round(edge.weightedJaccard * 100), terms: edge.sharedTerms.join(', ') }));
    const linkElements = root.selectAll<SVGLineElement, SimLink>('line.semantic-edge')
      .data(links, (edge) => edge.id)
      .join('line')
      .attr('class', 'semantic-edge')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', (edge) => Math.min(1 + Math.log2(edge.links), 4))
      .attr('marker-end', `url(#${markerId})`);

    const nodeElements = root.selectAll<SVGGElement, SimNode>('g.semantic-node')
      .data(nodes, (node) => node.id)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'semantic-node').style('cursor', 'grab');
        group.append('circle').attr('r', (node) => 7 + Math.min(node.semanticNode.semanticSignalCount / 10, 7)).attr('stroke', '#0f172a').attr('stroke-width', 2);
        group.append('text').attr('dy', 23).attr('text-anchor', 'middle').attr('fill', '#cbd5e1').attr('font-size', 10).attr('pointer-events', 'none');
        return group;
      })
      .attr('aria-label', (node) => t('mapUi.nodeAria', {
        label: node.semanticNode.page.title || shortUrl(node.semanticNode.page.url),
        cluster: node.semanticNode.clusterLabel,
      }))
      .attr('role', 'button')
      .attr('tabindex', '0')
      .attr('focusable', 'true')
      .attr('aria-pressed', (node) => node.id === selectedId ? 'true' : 'false')
      .on('click', (_event, node) => setSelectedId(node.id))
      .on('keydown', (event, node) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setSelectedId(node.id);
      });

    nodeElements.select<SVGCircleElement>('circle').attr('fill', (node) => node.color);
    nodeElements.select<SVGTextElement>('text').text((node) => shortUrl(node.semanticNode.page.url).slice(0, 34));

    const allForceLinks = [...links, ...topicLinks];
    const simulation = forceSimulation(nodes)
      .force('link', forceLink<SimNode, SimLink>(allForceLinks).id((node) => node.id).distance((edge) => edge.kind === 'content-link' ? 100 : 145).strength((edge) => edge.kind === 'content-link' ? 0.45 : 0.12))
      .force('charge', forceManyBody<SimNode>().strength(-230).distanceMax(560))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collision', forceCollide<SimNode>().radius((node) => 17 + Math.min(node.semanticNode.semanticSignalCount / 10, 7)).iterations(2))
      .alphaDecay(0.04)
      .on('tick', () => {
        const positionEdges = (elements: typeof linkElements) => elements
          .attr('x1', (edge) => (edge.source as SimNode).x ?? WIDTH / 2)
          .attr('y1', (edge) => (edge.source as SimNode).y ?? HEIGHT / 2)
          .attr('x2', (edge) => {
            const source = edge.source as SimNode;
            const target = edge.target as SimNode;
            const dx = (target.x ?? WIDTH / 2) - (source.x ?? WIDTH / 2);
            const distance = Math.hypot(dx, (target.y ?? HEIGHT / 2) - (source.y ?? HEIGHT / 2)) || 1;
            const radius = 10 + Math.min(target.semanticNode.semanticSignalCount / 10, 7);
            return (target.x ?? WIDTH / 2) - (dx / distance) * radius;
          })
          .attr('y2', (edge) => {
            const source = edge.source as SimNode;
            const target = edge.target as SimNode;
            const dy = (target.y ?? HEIGHT / 2) - (source.y ?? HEIGHT / 2);
            const distance = Math.hypot((target.x ?? WIDTH / 2) - (source.x ?? WIDTH / 2), dy) || 1;
            const radius = 10 + Math.min(target.semanticNode.semanticSignalCount / 10, 7);
            return (target.y ?? HEIGHT / 2) - (dy / distance) * radius;
          });
        positionEdges(topicElements);
        positionEdges(linkElements);
        nodeElements.attr('transform', (node) => `translate(${node.x ?? WIDTH / 2},${node.y ?? HEIGHT / 2})`);
      });

    nodeElements.call(drag<SVGGElement, SimNode>()
      .on('start', (event, node) => {
        if (!event.active) simulation.alphaTarget(0.25).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on('drag', (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on('end', (event, node) => {
        if (!event.active) simulation.alphaTarget(0);
        node.fx = null;
        node.fy = null;
        if (node.x !== undefined && node.y !== undefined) {
          setPreferences((previous) => ({
            ...previous,
            positions: Object.entries({
              ...previous.positions,
              [node.semanticNode.page.url]: { x: node.x!, y: node.y! },
            }).slice(-160).reduce<Record<string, LayoutPoint>>((next, [url, point]) => {
              next[url] = point;
              return next;
            }, {}),
          }));
        }
      }));

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => root.attr('transform', event.transform.toString()))
      .on('end.persist', (event) => {
        const { x, y, k } = event.transform;
        setPreferences((previous) => {
          if (previous.transform.x === x && previous.transform.y === y && previous.transform.k === k) return previous;
          return { ...previous, transform: { x, y, k } };
        });
      });
    zoomRef.current = zoomBehavior;
    select(svgElement).call(zoomBehavior);
    const savedTransform = preferences.transform;
    select(svgElement).call(zoomBehavior.transform, zoomIdentity.translate(savedTransform.x, savedTransform.y).scale(savedTransform.k));

    return () => {
      simulation.stop();
      select(svgElement).on('.zoom', null);
    };
  }, [graph.clusters, markerId, preferences.positions, selectedId, t, visibleEdges, visibleNodes, visibleTopicEdges]);

  const setQuery = (value: string) => setPreferences((previous) => ({ ...previous, query: value }));
  const setClusterFilter = (value: string) => setPreferences((previous) => ({ ...previous, clusterFilter: value }));
  const setOrphansOnly = (value: boolean) => setPreferences((previous) => ({ ...previous, orphansOnly: value }));
  const setLinkMode = (value: 'content' | 'all') => setPreferences((previous) => ({ ...previous, linkMode: value }));

  const resetView = () => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  };

  const scaleView = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };

  const setActiveView = (view: MapView) => {
    setActiveViewState(view);
    setPreferences((previous) => ({ ...previous, activeView: view }));
  };

  const scrollMapTabs = (direction: 'left' | 'right', ref: RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollBy?.({
      left: direction === 'left' ? -260 : 260,
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth',
    });
  };

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth';
    [mapTabsRef, bottomMapTabsRef].forEach((ref) => {
      ref.current?.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]')?.scrollIntoView?.({
        behavior,
        block: 'nearest',
        inline: 'center',
      });
    });
  }, [activeView]);

  const selectMapViewByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // Let the native picker keep its Arrow/Home/End behaviour on compact layouts.
    if (event.target instanceof HTMLSelectElement) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-map-view]'));
    const currentIndex = buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true' || button.getAttribute('aria-pressed') === 'true');
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const targetIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : direction
          ? (currentIndex + direction + buttons.length) % buttons.length
          : -1;
    if (targetIndex < 0 || !buttons[targetIndex]) return;
    event.preventDefault();
    const next = mapViewTabs[targetIndex];
    setActiveView(next.id);
    buttons[targetIndex].focus();
  };

  const returnToResults = () => {
    const results = document.getElementById('crawl-results');
    results?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth',
      block: 'start',
    });
    if (results instanceof HTMLElement) results.focus({ preventScroll: true });
  };

  const returnToMapStart = () => {
    const mapSection = document.getElementById('crawl-map-section');
    mapSection?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth',
      block: 'start',
    });
    if (mapSection instanceof HTMLElement) mapSection.focus({ preventScroll: true });
  };

  return (
    <section id="crawl-map-visualisation" aria-label={t('mapUi.sectionAria')} tabIndex={-1} className="scroll-pb-48 rounded-xl border border-slate-800 bg-slate-900/45 p-4 pb-48 outline-none md:scroll-pb-40 md:pb-40">
      <div className="sticky top-2 z-30 -mx-4 mb-4 border-b border-slate-800 bg-slate-900/95 px-4 pb-3 pt-0 shadow-lg shadow-black/10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/85">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">{t('mapUi.eyebrow')}</p>
            <h2 className="mt-0.5 text-sm font-semibold text-slate-100">{t('mapUi.title')}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10px] text-slate-500 sm:inline" aria-live="polite">{t('mapUi.active')}: <span className="font-medium text-slate-300">{mapViewTabs.find((tab) => tab.id === activeView)?.label}</span></span>
            <button type="button" onClick={returnToResults} className="inline-flex h-9 items-center rounded-md border border-slate-700 px-3 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.backToResults')}>{t('mapUi.results')}</button>
          </div>
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
        <button type="button" onClick={() => scrollMapTabs('left', mapTabsRef)} className="grid h-10 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.scrollTabsLeft')} title={t('mapUi.scrollTabsLeft')}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <div ref={mapTabsRef} role="tablist" aria-label={t('mapUi.tablistAria')} onKeyDown={selectMapViewByKey} className="scrollbar-thin flex min-w-0 flex-1 snap-x snap-mandatory gap-1 overflow-x-auto scroll-smooth">
          {mapViewTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeView === tab.id;
            return (
              <button
                key={tab.id}
                id={`crawl-map-view-${tab.id}`}
                data-map-view="true"
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="crawl-map-view-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveView(tab.id)}
                className={`flex min-h-11 min-w-[11rem] flex-1 snap-start items-center gap-2 rounded-md px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:min-w-0 ${selected ? tab.id === 'directory' ? 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/20' : tab.id === 'plan' ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/20' : 'bg-slate-800 text-white ring-1 ring-slate-600/60' : 'text-slate-500 hover:bg-slate-800/70 hover:text-slate-200'}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{tab.label}</span>
                  <span aria-hidden="true" className="hidden truncate text-[10px] text-slate-500 sm:block">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => scrollMapTabs('right', mapTabsRef)} className="grid h-10 w-9 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.scrollTabsRight')} title={t('mapUi.scrollTabsRight')}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <p className="mt-1 text-[10px] text-slate-600 sm:hidden">{t('mapUi.compactHint')}</p>
      </div>
      <div id="crawl-map-view-panel" role="tabpanel" aria-labelledby={`crawl-map-view-${activeView}`}>
      {activeView === 'plan' ? <SemanticTopicalWorkspace projectId={activeProjectId} pages={pages} graph={contentGraph} runId={effectiveRunId} sitemapUrls={sitemapUrls} runs={runs} currentRunId={currentRunId ?? effectiveRunId} /> : activeView === 'directory' ? <CrawlDirectoryTree pages={pages} projectId={activeProjectId} runId={effectiveRunId} onSelectPage={(url) => {
        const node = graph.nodes.find((candidate) => candidate.page.url === url);
        if (node) setSelectedId(node.id);
      }} /> : <>
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{t(linkMode === 'all' ? 'mapUi.graph.fullTitle' : 'mapUi.graph.contentTitle')}</h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{t(linkMode === 'all' ? 'mapUi.graph.fullDescription' : 'mapUi.graph.contentDescription', { source: semanticSourceLabel })}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-slate-300">{t('mapUi.metrics.urlCount', { visible: visibleNodes.length, total: graph.nodes.length })}</span>
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-slate-300">{localizedPlural(visibleEdges.length, 'relation')}{graph.totalEdges > graph.edges.length ? ` / ${graph.totalEdges} ${t('mapUi.metrics.total')}` : ''} · {localizedPlural(contentIncoming, linkMode === 'all' ? 'internalLink' : 'contentLink')}</span>
          <span className="rounded-md border border-sky-500/20 bg-slate-950/50 px-2 py-1 text-sky-200">{localizedPlural(visibleTopicEdges.length, 'topicSimilarity')}{graph.totalTopicEdges > graph.topicEdges.length ? ` / ${graph.totalTopicEdges} ${t('mapUi.metrics.total')}` : ''}</span>
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-amber-200">{localizedPlural(graph.nodes.filter((node) => node.orphan).length, linkMode === 'all' ? 'orphanGraph' : 'orphanContent')}</span>
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-sky-200">{t('mapUi.metrics.contentSources', { primary: semanticSourceCounts['primary-root'] || 0, fallback: semanticSourceCounts['body-fallback'] || 0, unavailable: semanticSourceCounts.unavailable || 0, partial: semanticPartialCount })}</span>
        </div>
      </div>

      {!graph.hasSemanticTerms && <p role="status" className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">{t('mapUi.noterms')}</p>}
      {graph.truncated && <p className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-100">{t('mapUi.truncated')}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 p-0.5" role="group" aria-label={t('mapUi.linkScopeAria')}>
          <button type="button" onClick={() => setLinkMode('content')} aria-pressed={linkMode === 'content'} className={`h-7 rounded px-2 text-[11px] font-medium transition ${linkMode === 'content' ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{t('mapUi.contentOnly')}</button>
          <button type="button" onClick={() => setLinkMode('all')} aria-pressed={linkMode === 'all'} className={`h-7 rounded px-2 text-[11px] font-medium transition ${linkMode === 'all' ? 'bg-sky-500/15 text-sky-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{t('mapUi.allLinks')}</button>
        </div>
        <label className="min-w-48 flex-1 text-[11px] text-slate-500">{t('mapUi.searchLabel')}<input aria-label={t('mapUi.searchAria')} value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400" placeholder={t('mapUi.searchPlaceholder')} /></label>
        <label className="text-[11px] text-slate-500">{t('mapUi.clusterLabel')}<select aria-label={t('mapUi.clusterAria')} value={clusterFilter} onChange={(event) => setClusterFilter(event.target.value)} className="mt-1 block h-8 max-w-64 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400"><option value="all">{t('mapUi.allClusters', { count: graph.clusters.length })}</option>{graph.clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.label} · {cluster.pageCount}</option>)}</select></label>
        <label className="flex h-8 items-center gap-2 self-end rounded-md border border-slate-700 px-2 text-[11px] text-slate-300"><input type="checkbox" checked={orphansOnly} onChange={(event) => setOrphansOnly(event.target.checked)} />{t('mapUi.orphansOnly')}</label>
        <div className="flex h-8 self-end items-center gap-1 rounded-md border border-slate-700 bg-slate-950/50 p-0.5" role="group" aria-label={t('mapUi.zoomControlsAria')}>
          <button type="button" onClick={() => scaleView(1.2)} className="h-7 rounded px-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.zoomIn')} title={t('mapUi.zoomIn')}>+</button>
          <button type="button" onClick={() => scaleView(1 / 1.2)} className="h-7 rounded px-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.zoomOut')} title={t('mapUi.zoomOut')}>−</button>
          <button type="button" onClick={resetView} className="h-7 rounded px-2 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.resetZoom')} title={t('mapUi.resetZoom')}>{t('mapUi.resetZoom')}</button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('mapUi.svgAria')} className="h-[420px] w-full touch-none sm:h-[560px]">
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,8 L8,4 z" fill="#64748b" /></marker></defs>
          <g ref={graphLayerRef} />
        </svg>
      </div>
      <p className="mt-2 text-[10px] text-slate-600">{t('mapUi.legendHelp')}</p>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
        <div className="flex flex-wrap gap-2" aria-label={t('mapUi.clusterLegend')}>
          {graph.clusters.slice(0, 12).map((cluster, index) => <span key={cluster.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 px-2 py-1 text-[10px] text-slate-400"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }} />{cluster.label} · {cluster.pageCount}</span>)}
          {graph.clusters.length > 12 && <span className="self-center text-[10px] text-slate-500">{t('mapUi.moreClusters', { count: graph.clusters.length - 12 })}</span>}
        </div>
        <aside aria-live="polite" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          {selectedNode ? <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">{t('mapUi.selectedPage')}</p>
            <p className="mt-1 break-words text-xs font-medium text-white">{selectedNode.page.title || shortUrl(selectedNode.page.url)}</p>
            <a href={selectedNode.page.url} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-[10px] text-slate-500">{selectedNode.page.url}</a>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
              <span>{t('mapUi.topicLabel')}: {selectedNode.clusterLabel}</span><span>·</span>
              <span>{localizedPlural(selectedNode.semanticSignalCount, 'term')}</span><span>·</span>
              <span>{t('mapUi.incomingLinks', { count: selectedNode.incomingContentLinks, label: t(linkMode === 'all' ? 'mapUi.internalLinks' : 'mapUi.contentLinks') })}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{t('mapUi.contentSource')}: <span className="text-slate-300">{semanticRegionLabel(selectedNode.page.semantic_content_source)}</span> · {t('mapUi.source.provenance')}: <span className="text-slate-300">{semanticProvenanceLabel(selectedNode.page.semantic_content_provenance, selectedNode.page.semantic_content_source)}</span>{selectedNode.page.semantic_content_partial ? <span className="text-amber-300"> · {t('mapUi.source.partial')}</span> : null} · {t('mapUi.outgoingLinks', { count: selectedOutboundEdges.length })}</p>
            {selectedTopicEdges.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-400">
              <p className="font-medium text-sky-200">{t('mapUi.similarityNotLink')}</p>
              {selectedTopicEdges.map((edge) => {
                const relatedId = edge.source === selectedId ? edge.target : edge.source;
                const related = nodeById.get(relatedId);
                return <p key={edge.id} className="break-all"><span className="text-slate-300">{related ? shortUrl(related.page.url) : relatedId}</span> · {Math.round(edge.weightedJaccard * 100)}% · {t('mapUi.sharedTerms')}: {edge.sharedTerms.join(', ') || '—'}</p>;
              })}
            </div>}
            {selectedOutboundEdges.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-400">
              <p className="font-medium text-emerald-200">{t('mapUi.contentLinksTitle')}</p>
              {selectedOutboundEdges.map((edge) => {
                const target = nodeById.get(edge.target);
                return <p key={edge.id} className="break-all"><span className="text-slate-300">{target ? shortUrl(target.page.url) : edge.target}</span>{edge.anchors.length ? ` · „${edge.anchors.join('”, „')}”` : ''} · {edge.links}×</p>;
              })}
            </div>}
            {selectedNode.page.discovery_sources?.length ? <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-400"><p className="font-medium text-sky-200">{t('mapUi.urlDiscovery')}</p>{selectedNode.page.discovery_sources.slice(0, 3).map((source, index) => <p key={`${source.kind}-${source.source_url || 'none'}-${index}`} className="break-all"><span className="text-sky-200">{discoveryLabel(source.kind, t)}</span>{source.source_url ? ` · ${shortUrl(source.source_url)}` : ''}{source.anchor_text ? ` · „${source.anchor_text}”` : ''}</p>)}</div> : null}
            {selectedNode.orphan && <p className="mt-1 text-[10px] text-amber-300">{t('mapUi.noIncoming', { label: t(linkMode === 'all' ? 'mapUi.internalLink' : 'mapUi.contentLink') })}</p>}
          </> : <p className="text-xs text-slate-500">{t('mapUi.selectNodeHint', { label: t(linkMode === 'all' ? 'mapUi.internalLinks' : 'mapUi.contentLinks') })}</p>}
        </aside>
      </div>

      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-300">{t('mapUi.pageList', { count: visibleNodes.length })}</summary>
        <ul className="max-h-56 divide-y divide-slate-800 overflow-auto px-3">
          {visibleNodes.map((node) => <li key={node.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-[11px]"><button type="button" onClick={() => setSelectedId(node.id)} className="max-w-full truncate text-left font-mono text-emerald-200 hover:underline">{shortUrl(node.page.url)}</button><span className="text-slate-500">{node.clusterLabel}</span><span className="text-slate-600">· {localizedPlural(node.semanticSignalCount, 'term')}</span>{node.orphan && <span className="text-amber-300">{t(linkMode === 'all' ? 'mapUi.orphanGraph' : 'mapUi.orphanContent')}</span>}</li>)}
        </ul>
      </details>
      </>}
      </div>

      <div
        className={`pointer-events-none fixed inset-x-3 z-40 scroll-mt-28 scroll-mb-48 md:right-4 ${sidebarCollapsed ? 'md:left-[4.5rem]' : 'md:left-[16.5rem]'}`}
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        data-testid="crawl-map-bottom-navigation"
      >
        <nav
          aria-label={t('mapUi.bottomNavigationAria')}
          className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/90 bg-slate-950/95 p-2.5 shadow-2xl shadow-black/50 ring-1 ring-black/20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2" role="toolbar" aria-label={t('mapUi.bottomViewsAria')} onKeyDown={selectMapViewByKey}>
            <MapPinned className="hidden h-4 w-4 shrink-0 text-emerald-300 sm:inline" aria-hidden="true" />
            <span className="hidden shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:inline">{t('mapUi.mapView')}</span>
            <label className="relative min-w-0 flex-1 sm:hidden">
              <span className="sr-only">{t('mapUi.chooseMapView')}</span>
              <select
                aria-label={t('mapUi.chooseMapView')}
                value={activeView}
                onChange={(event) => setActiveView(event.target.value as MapView)}
                className="h-9 w-full appearance-none rounded-md border border-slate-700 bg-slate-900 px-3 pr-8 text-xs font-medium text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              >
                {mapViewTabs.map((tab) => <option key={`mobile-${tab.id}`} value={tab.id}>{tab.label} · {tab.description}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            </label>
            <button type="button" onClick={() => scrollMapTabs('left', bottomMapTabsRef)} className="hidden h-10 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:grid" aria-label={t('mapUi.scrollBottomLeft')} title={t('mapUi.scrollBottomLeft')}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
            <div ref={bottomMapTabsRef} className="scrollbar-thin hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth sm:flex" aria-label={t('mapUi.bottomTablistAria')}>
            {mapViewTabs.map((tab) => (
              <button
                key={`bottom-${tab.id}`}
                type="button"
                data-map-view="true"
                aria-pressed={activeView === tab.id}
                aria-current={activeView === tab.id ? 'page' : undefined}
                aria-label={t('mapUi.goToView', { view: tab.label })}
                onClick={() => setActiveView(tab.id)}
                className={`min-h-10 shrink-0 rounded-md px-3 py-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${activeView === tab.id ? 'bg-emerald-400/10 text-emerald-200 shadow-inner shadow-emerald-300/5' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
              >
                <span className="flex items-center gap-1.5">
                  <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {tab.label}
                </span>
              </button>
            ))}
            </div>
            <button type="button" onClick={() => scrollMapTabs('right', bottomMapTabsRef)} className="hidden h-10 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:grid" aria-label={t('mapUi.scrollBottomRight')} title={t('mapUi.scrollBottomRight')}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="flex shrink-0 items-center gap-1 border-l border-slate-800 pl-1">
            <span className="hidden px-1 text-[10px] text-slate-500 lg:inline" aria-live="polite">{t('mapUi.active')}: <span className="text-slate-300">{mapViewTabs.find((tab) => tab.id === activeView)?.label}</span> · {mapViewTabs.findIndex((tab) => tab.id === activeView) + 1}/{mapViewTabs.length}</span>
            <button
              type="button"
              onClick={returnToMapStart}
              className="rounded-md px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={t('mapUi.backToMapStart')}
              title={t('mapUi.backToMapStart')}
            >
              {t('mapUi.start')}
            </button>
            <button
              type="button"
              onClick={returnToResults}
              className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={t('mapUi.backToResults')}
              title={t('mapUi.backToResults')}
            >
              {t('mapUi.results')}
            </button>
          </div>
        </nav>
      </div>
    </section>
  );
};
