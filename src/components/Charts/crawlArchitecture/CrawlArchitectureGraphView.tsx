import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { select } from 'd3-selection';
import { zoomIdentity } from 'd3-zoom';
import { WIDTH, HEIGHT } from './CrawlArchitectureTypes';
import { useCrawlArchitectureSimulation } from './useCrawlArchitectureSimulation';
import { CrawlArchitectureControls } from './CrawlArchitectureControls';
import { CrawlArchitectureSidebar } from './CrawlArchitectureSidebar';
import { GraphEvidencePanel } from './GraphEvidencePanel';
import { shortUrl } from './CrawlArchitectureHelpers';

export const CrawlArchitectureGraphView = ({ state, crawlMode }: any) => {
  const { t } = useTranslation();
  const markerId = `semantic-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const graphLayerRef = useRef<SVGGElement | null>(null);

  const { zoomRef } = useCrawlArchitectureSimulation({
    svgRef, graphLayerRef, markerId, t, ...state
  });

  const resetView = () => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity); };
  const scaleView = (factor: number) => { if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor); };

  const { visibleNodes, setSelectedId, graph, preferences } = state;
  const { linkMode } = preferences;

  const localizedPlural = (count: number, key: string) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = count === 1 ? 'one' : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'few' : 'many';
    return t(`mapUi.plural.${key}.${form}`, { count });
  };

  return (
    <>
      <CrawlArchitectureControls preferences={preferences} setPreferences={state.setPreferences} graph={graph} scaleView={scaleView} resetView={resetView} />
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('mapUi.svgAria')} className="h-[420px] w-full touch-none sm:h-[560px]">
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,8 L8,4 z" fill="#64748b" /></marker></defs>
          <g ref={graphLayerRef} />
        </svg>
      </div>
      <p className="mt-2 text-[10px] text-slate-600">{t('mapUi.legendHelp')}</p>
      
      <CrawlArchitectureSidebar {...state} crawlMode={crawlMode} />
      
      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-300">{t('mapUi.pageList', { count: visibleNodes.length })}</summary>
        <ul className="max-h-56 divide-y divide-slate-800 overflow-auto px-3">
          {visibleNodes.map((node: any) => <li key={node.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-[11px]"><button type="button" onClick={() => setSelectedId(node.id)} className="max-w-full truncate text-left font-mono text-emerald-200 hover:underline">{shortUrl(node.page.url)}</button><span className="text-slate-500">{node.clusterLabel}</span><span className="text-slate-600">· {localizedPlural(node.semanticSignalCount, 'term')}</span>{node.orphan && <span className="text-amber-300">{t(linkMode === 'all' ? 'mapUi.orphanGraph' : 'mapUi.orphanContent')}</span>}</li>)}
        </ul>
      </details>
      <GraphEvidencePanel graph={graph} />
    </>
  );
};
