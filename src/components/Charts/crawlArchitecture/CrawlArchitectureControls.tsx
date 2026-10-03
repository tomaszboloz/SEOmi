import { useTranslation } from 'react-i18next';
import type { SemanticMapPreferences } from './CrawlArchitectureTypes';

interface Props {
  preferences: SemanticMapPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<SemanticMapPreferences>>;
  graph: any;
  scaleView: (factor: number) => void;
  resetView: () => void;
}

export const CrawlArchitectureControls = ({ preferences, setPreferences, graph, scaleView, resetView }: Props) => {
  const { t } = useTranslation();
  const { query, clusterFilter, orphansOnly, linkMode } = preferences;

  const setQuery = (value: string) => setPreferences((prev) => ({ ...prev, query: value }));
  const setClusterFilter = (value: string) => setPreferences((prev) => ({ ...prev, clusterFilter: value }));
  const setOrphansOnly = (value: boolean) => setPreferences((prev) => ({ ...prev, orphansOnly: value }));
  const setLinkMode = (value: 'content' | 'all') => setPreferences((prev) => ({ ...prev, linkMode: value }));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 p-0.5" role="group" aria-label={t('mapUi.linkScopeAria')}>
        <button type="button" onClick={() => setLinkMode('content')} aria-pressed={linkMode === 'content'} className={`h-7 rounded px-2 text-[11px] font-medium transition ${linkMode === 'content' ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{t('mapUi.contentOnly')}</button>
        <button type="button" onClick={() => setLinkMode('all')} aria-pressed={linkMode === 'all'} className={`h-7 rounded px-2 text-[11px] font-medium transition ${linkMode === 'all' ? 'bg-sky-500/15 text-sky-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{t('mapUi.allLinks')}</button>
      </div>
      <label className="min-w-48 flex-1 text-[11px] text-slate-500">{t('mapUi.searchLabel')}<input aria-label={t('mapUi.searchAria')} value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400" placeholder={t('mapUi.searchPlaceholder')} /></label>
      <label className="text-[11px] text-slate-500">{t('mapUi.clusterLabel')}<select aria-label={t('mapUi.clusterAria')} value={clusterFilter} onChange={(event) => setClusterFilter(event.target.value)} className="mt-1 block h-8 max-w-64 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400"><option value="all">{t('mapUi.allClusters', { count: graph.clusters.length })}</option>{graph.clusters.map((cluster: any) => <option key={cluster.id} value={cluster.id}>{cluster.label} · {cluster.pageCount}</option>)}</select></label>
      <label className="flex h-8 items-center gap-2 self-end rounded-md border border-slate-700 px-2 text-[11px] text-slate-300"><input type="checkbox" checked={orphansOnly} onChange={(event) => setOrphansOnly(event.target.checked)} />{t('mapUi.orphansOnly')}</label>
      <div className="flex h-8 self-end items-center gap-1 rounded-md border border-slate-700 bg-slate-950/50 p-0.5" role="group" aria-label={t('mapUi.zoomControlsAria')}>
        <button type="button" onClick={() => scaleView(1.2)} className="h-7 rounded px-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.zoomIn')} title={t('mapUi.zoomIn')}>+</button>
        <button type="button" onClick={() => scaleView(1 / 1.2)} className="h-7 rounded px-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.zoomOut')} title={t('mapUi.zoomOut')}>−</button>
        <button type="button" onClick={resetView} className="h-7 rounded px-2 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label={t('mapUi.resetZoom')} title={t('mapUi.resetZoom')}>{t('mapUi.resetZoom')}</button>
      </div>
    </div>
  );
};
