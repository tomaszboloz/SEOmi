import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GscPerformanceData } from '@/types';
import type { SemanticMap } from '@/services/semanticMap';
import { calculatePageRank } from '@/services/semanticGraph/pageRank';
import { buildTrafficEvidence, type TrafficEvidence } from '@/services/semanticGraph/trafficEvidence';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { shortUrl } from './CrawlArchitectureHelpers';

interface Props { graph: SemanticMap; }

const isGscData = (value: unknown): value is GscPerformanceData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Partial<GscPerformanceData>;
  return typeof data.site_url === 'string' && typeof data.start_date === 'string'
    && typeof data.end_date === 'string' && Array.isArray(data.pages);
};

const metric = (value: number | null, digits = 0): string => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const percent = (value: number | null): string => value === null ? '—' : `${(value * 100).toFixed(2)}%`;

const filterLabel = (filters: TrafficEvidence['filters'], allLabel: string): string => {
  if (!filters || !Object.keys(filters).length) return allLabel;
  return [filters.search_type, filters.device, filters.country?.toUpperCase()].filter(Boolean).join(' · ');
};

const evidenceLabel = (evidence: TrafficEvidence | null, nodeId: string, t: (key: string) => string): string => {
  const observation = evidence?.nodes.find((node) => node.nodeId === nodeId)?.observation;
  return t(`mapUi.graphEvidence.observation.${observation ?? 'unavailable'}`);
};

export const GraphEvidencePanel = ({ graph }: Props) => {
  const { t } = useTranslation();
  const projectId = useProjectStore((state) => state.activeProjectId);
  const selectedProperty = useToolsStore((state) => state.gscProperty);
  const selectedFilters = useToolsStore((state) => state.gscFilters);
  const rawGscData = useToolsStore((state) => state.gscData);
  const gscData = isGscData(rawGscData) ? rawGscData : null;
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const pageRank = useMemo(() => calculatePageRank(graphNodes, graphEdges), [graphEdges, graphNodes]);
  const traffic = useMemo(() => {
    if (!projectId || !selectedProperty || !gscData) return null;
    return buildTrafficEvidence({ projectId, property: selectedProperty, startDate: gscData.start_date, endDate: gscData.end_date, filters: selectedFilters, nodes: graphNodes, gscData });
  }, [gscData, graphNodes, projectId, selectedFilters, selectedProperty]);
  const rankedNodes = pageRank.scores.slice(0, 8).map((score) => ({ score, node: graphNodes.find((candidate) => candidate.id === score.nodeId) })).filter((item) => item.node);
  const observed = traffic?.matchedNodeIds.length ?? 0;
  const uncertain = traffic?.uncertainNodeIds.length ?? 0;
  const missing = traffic?.missingNodeIds.length ?? 0;

  return <section aria-label={t('mapUi.graphEvidence.sectionAria')} className="mt-4 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
    <div><h3 className="text-sm font-semibold text-slate-100">{t('mapUi.graphEvidence.title')}</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">{t('mapUi.graphEvidence.description')}</p></div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      <article aria-label={t('mapUi.graphEvidence.structureAria')} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <h4 className="text-xs font-semibold text-emerald-200">{t('mapUi.graphEvidence.structureTitle')}</h4>
        <p className="mt-1 text-[10px] text-slate-500">{t('mapUi.graphEvidence.structureMeta', { iterations: pageRank.iterations, status: pageRank.converged ? t('mapUi.graphEvidence.converged') : t('mapUi.graphEvidence.bounded') })}</p>
        <ol className="mt-2 space-y-1.5">{rankedNodes.map(({ score, node }, index) => <li key={node!.id} className="flex items-center gap-2 text-[11px]"><span className="w-5 text-slate-500">{index + 1}.</span><span className="min-w-0 flex-1 truncate text-slate-200" title={node!.page.url}>{shortUrl(node!.page.url)}</span><span className="font-mono text-emerald-200">{(score.score * 100).toFixed(2)}%</span></li>)}</ol>
        {!rankedNodes.length && <p className="mt-2 text-[10px] text-slate-500">{t('mapUi.graphEvidence.noNodes')}</p>}
        <p className="mt-2 text-[10px] text-slate-500">{t('mapUi.graphEvidence.structureNote')}</p>
        {graph.truncated && <p role="note" className="mt-2 text-[10px] text-amber-200">{t('mapUi.graphEvidence.structurePartial')}</p>}
      </article>
      <article aria-label={t('mapUi.graphEvidence.trafficAria')} className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <h4 className="text-xs font-semibold text-sky-200">{t('mapUi.graphEvidence.trafficTitle')}</h4>
        <p className="mt-1 text-[10px] text-slate-400">{t(`mapUi.graphEvidence.status.${traffic?.status ?? 'unavailable'}`)}</p>
        {traffic ? <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400"><dt>{t('mapUi.graphEvidence.project')}</dt><dd className="truncate text-slate-200">{traffic.projectId}</dd><dt>{t('mapUi.graphEvidence.property')}</dt><dd className="truncate text-slate-200">{traffic.property?.key ?? '—'}</dd><dt>{t('mapUi.graphEvidence.period')}</dt><dd className="text-slate-200">{traffic.dateRange?.startDate} → {traffic.dateRange?.endDate}</dd><dt>{t('mapUi.graphEvidence.filters')}</dt><dd className="truncate text-slate-200">{filterLabel(traffic.filters, t('mapUi.graphEvidence.allFilters'))}</dd></dl> : <p className="mt-2 text-[10px] text-amber-200">{t('mapUi.graphEvidence.noSelection')}</p>}
        <p className="mt-2 text-[10px] text-slate-400">{t('mapUi.graphEvidence.counts', { observed, uncertain, missing })}</p>
        {traffic?.status === 'partial' && <p role="note" className="mt-2 text-[10px] text-amber-200">{t('mapUi.graphEvidence.partialNotice')}</p>}
        {traffic?.status === 'invalid' && <p role="note" className="mt-2 text-[10px] text-rose-200">{t('mapUi.graphEvidence.invalidNotice')}</p>}
        {traffic && (traffic.invalidRows > 0 || traffic.ignoredRows > 0) && <p role="note" className="mt-2 text-[10px] text-slate-400">{t('mapUi.graphEvidence.rowQuality', { invalid: traffic.invalidRows, ignored: traffic.ignoredRows })}</p>}
        <ul className="mt-2 space-y-1.5">{rankedNodes.map(({ node }) => { const row = traffic?.nodes.find((item) => item.nodeId === node!.id); return <li key={`traffic-${node!.id}`} className="flex items-center gap-2 text-[10px]"><span className="min-w-0 flex-1 truncate text-slate-300" title={node!.page.url}>{shortUrl(node!.page.url)}</span><span className="text-slate-500">{evidenceLabel(traffic, node!.id, t)}</span><span className="font-mono text-sky-200">{row?.observed ? `${metric(row.metrics.clicks)} / ${percent(row.metrics.ctr)}` : '—'}</span></li>; })}</ul>
        <p className="mt-2 text-[10px] text-slate-500">{t('mapUi.graphEvidence.trafficNote')}</p>
      </article>
    </div>
  </section>;
};
