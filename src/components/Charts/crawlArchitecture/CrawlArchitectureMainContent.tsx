import { useTranslation } from 'react-i18next';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import { CrawlDirectoryTree } from '@/components/Charts/CrawlDirectoryTree';
import { CrawlArchitectureGraphView } from './CrawlArchitectureGraphView';

export const CrawlArchitectureMainContent = ({
  pages, crawlMode, sitemapUrls, runs, currentRunId, state
}: any) => {
  const { t } = useTranslation();
  const {
    activeProjectId, effectiveRunId, activeView, graph, contentGraph,
    visibleNodes, visibleEdges, visibleTopicEdges, preferences, setSelectedId
  } = state;

  const contentIncoming = graph.totalInternalLinks;
  const semanticSourceCounts = pages.reduce((counts: Record<string, number>, page: any) => {
    const source = page.semantic_content_source || 'unavailable';
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const semanticPartialCount = pages.filter((page: any) => page.semantic_content_partial === true).length;
  const semanticSourceLabel = crawlMode === 'browser-rendered' ? t('mapUi.source.browser') : t('mapUi.source.http');

  const localizedPlural = (count: number, key: string) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = count === 1 ? 'one' : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'few' : 'many';
    return t(`mapUi.plural.${key}.${form}`, { count });
  };

  if (activeView === 'plan') return <SemanticTopicalWorkspace projectId={activeProjectId} pages={pages} graph={contentGraph} runId={effectiveRunId} sitemapUrls={sitemapUrls} runs={runs} currentRunId={currentRunId ?? effectiveRunId} />;
  
  if (activeView === 'directory') return <CrawlDirectoryTree pages={pages} projectId={activeProjectId} runId={effectiveRunId} onSelectPage={(url) => {
    const node = graph.nodes.find((candidate: any) => candidate.page.url === url);
    if (node) setSelectedId(node.id);
  }} />;

  return (
    <>
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{t(preferences.linkMode === 'all' ? 'mapUi.graph.fullTitle' : 'mapUi.graph.contentTitle')}</h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">{t(preferences.linkMode === 'all' ? 'mapUi.graph.fullDescription' : 'mapUi.graph.contentDescription', { source: semanticSourceLabel })}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-slate-300">{t('mapUi.metrics.urlCount', { visible: visibleNodes.length, total: graph.nodes.length })}</span>
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-slate-300">{localizedPlural(visibleEdges.length, 'relation')}{graph.totalEdges > graph.edges.length ? ` / ${graph.totalEdges} ${t('mapUi.metrics.total')}` : ''} · {localizedPlural(contentIncoming, preferences.linkMode === 'all' ? 'internalLink' : 'contentLink')}</span>
          <span className="rounded-md border border-sky-500/20 bg-slate-950/50 px-2 py-1 text-sky-200">{localizedPlural(visibleTopicEdges.length, 'topicSimilarity')}{graph.totalTopicEdges > graph.topicEdges.length ? ` / ${graph.totalTopicEdges} ${t('mapUi.metrics.total')}` : ''}</span>
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-amber-200">{localizedPlural(graph.nodes.filter((node: any) => node.orphan).length, preferences.linkMode === 'all' ? 'orphanGraph' : 'orphanContent')}</span>
          <span className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-sky-200">{t('mapUi.metrics.contentSources', { primary: semanticSourceCounts['primary-root'] || 0, fallback: semanticSourceCounts['body-fallback'] || 0, unavailable: semanticSourceCounts.unavailable || 0, partial: semanticPartialCount })}</span>
        </div>
      </div>
      {!graph.hasSemanticTerms && <p role="status" className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">{t('mapUi.noterms')}</p>}
      {graph.truncated && <p className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-sky-100">{t('mapUi.truncated')}</p>}
      
      <CrawlArchitectureGraphView state={state} crawlMode={crawlMode} />
    </>
  );
};
