import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CrawlArchitectureControls } from '../CrawlArchitectureControls';
import { CrawlArchitectureSidebar } from '../CrawlArchitectureSidebar';
import { GraphEvidencePanel } from '../GraphEvidencePanel';
import { maxDepthOf } from './mapNodes';
import { useMapModel } from './mapState';
import { useCytoscapeMap, type HoverInfo } from './useCytoscapeMap';
import { MapDetails, MapTooltip } from './MapDetails';
import { MapTable } from './MapTable';
import { MapToolbar } from './MapToolbar';

export const CytoscapeMapView = ({ state, crawlMode, pages, startUrl }: any) => {
  const { t } = useTranslation();
  const { visibleNodes, visibleEdges, setSelectedId, selectedId, graph, preferences } = state;
  const model = useMapModel(pages ?? [], startUrl ?? '', visibleNodes, visibleEdges);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const { containerRef, zoomBy, fit } = useCytoscapeMap({
    elements: model.elements, layoutMode: model.layoutMode, matches: model.matches, selectedId: selectedId ?? null,
    onSelect: setSelectedId, onToggleSection: model.toggleSection, onHover: setHover,
  });
  const byId = useMemo(() => new Map(model.allNodes.map((node) => [node.id, node])), [model.allNodes]);
  const hovered = hover ? byId.get(hover.id) : undefined;
  return (
    <>
      <CrawlArchitectureControls preferences={preferences} setPreferences={state.setPreferences} graph={graph} scaleView={zoomBy} resetView={fit} diagnosis={state.diagnosis} />
      <MapToolbar layoutMode={model.layoutMode} setLayoutMode={model.setLayoutMode} filters={model.filters} setFilters={model.setFilters} maxDepth={maxDepthOf(model.allNodes)} highlight={model.highlight} setHighlight={model.setHighlight} matchCount={model.matches.size} hasTrs={model.hasTrs} setAllCollapsed={model.setAllCollapsed} />
      <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
        <div ref={containerRef} role="img" aria-label={t('mapUi.cy.mapAria')} className="h-[620px] w-full" />
        {hover && hovered && <MapTooltip node={hovered} x={hover.x} y={hover.y} />}
      </div>
      <p className="mt-2 text-slate-600">{t('mapUi.cy.mapHelp')}</p>
      <MapDetails node={selectedId ? byId.get(selectedId) : undefined} />
      <CrawlArchitectureSidebar {...state} crawlMode={crawlMode} />
      <MapTable nodes={model.nodes} onSelect={setSelectedId} />
      <GraphEvidencePanel graph={graph} />
    </>
  );
};
