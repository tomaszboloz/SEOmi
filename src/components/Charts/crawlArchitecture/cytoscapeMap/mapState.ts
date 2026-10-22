import { useMemo, useState } from 'react';
import type { SemanticContentEdge, SemanticPageNode } from '@/services/semanticMap';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { CrawledPageSummary } from '@/types';
import type { LayoutMode, MapEdge, MapFilters, MapNode } from './mapTypes';
import { emptyFilters } from './mapTypes';
import { applyMapFilters, buildMapNodes, keepEdges, matchIds } from './mapNodes';
import { allSections, resolveCollapsed } from './sections';
import { buildElements } from './buildElements';

/** Page URL to TRS lookup; empty when the Site Focus report cannot be built. */
export const trsLookup = (pages: CrawledPageSummary[], startUrl: string): Record<string, number> => {
  try {
    const report = buildSiteFocusReport(pages as never, startUrl, { now: new Date(0).toISOString() });
    return Object.fromEntries(report.pages.filter((page) => !page.skipped).map((page) => [page.url, page.trs]));
  } catch {
    return {};
  }
};

export const toMapEdges = (edges: SemanticContentEdge[]): MapEdge[] => edges.map(({ id, source, target, links }) => ({ id, source, target, links }));

export const useMapModel = (pages: CrawledPageSummary[], startUrl: string, visibleNodes: SemanticPageNode[], visibleEdges: SemanticContentEdge[]) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const [filters, setFilters] = useState<MapFilters>(emptyFilters);
  const [highlight, setHighlight] = useState('');
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const trs = useMemo(() => trsLookup(pages, startUrl), [pages, startUrl]);
  const allNodes = useMemo(() => buildMapNodes(visibleNodes, trs), [visibleNodes, trs]);
  const nodes = useMemo(() => applyMapFilters(allNodes, filters), [allNodes, filters]);
  const edges = useMemo(() => keepEdges(toMapEdges(visibleEdges), nodes), [visibleEdges, nodes]);
  const collapsed = useMemo(() => resolveCollapsed(nodes, toggled), [nodes, toggled]);
  const elements = useMemo(() => buildElements(nodes, edges, { grouped: layoutMode === 'force', collapsed }), [nodes, edges, layoutMode, collapsed]);
  const matches = useMemo(() => matchIds(nodes, highlight), [nodes, highlight]);
  const toggleSection = (section: string) => setToggled((previous) => {
    const next = new Set(previous);
    if (!next.delete(section)) next.add(section);
    return next;
  });
  const setAllCollapsed = (collapseAll: boolean) => {
    const sections = allSections(nodes);
    const big = resolveCollapsed(nodes, new Set()).size > 0;
    setToggled(new Set(collapseAll === big ? [] : sections));
  };
  return { layoutMode, setLayoutMode, filters, setFilters, highlight, setHighlight, nodes, allNodes, elements, matches, collapsed, toggleSection, setAllCollapsed, hasTrs: Object.keys(trs).length > 0 };
};

export type MapModel = ReturnType<typeof useMapModel>;
export type { MapNode };
