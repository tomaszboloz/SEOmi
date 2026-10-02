import { useTranslation } from 'react-i18next';
import { CLUSTER_COLORS } from './CrawlArchitectureTypes';
import { shortUrl, discoveryLabel } from './CrawlArchitectureHelpers';

export const CrawlArchitectureSidebar = ({
  graph, selectedNode, selectedId, selectedTopicEdges, selectedOutboundEdges,
  nodeById, linkMode, crawlMode
}: any) => {
  const { t } = useTranslation();

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

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
      <div className="flex flex-wrap gap-2" aria-label={t('mapUi.clusterLegend')}>
        {graph.clusters.slice(0, 12).map((cluster: any, index: number) => <span key={cluster.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 px-2 py-1 text-[10px] text-slate-400"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }} />{cluster.label} · {cluster.pageCount}</span>)}
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
            {selectedTopicEdges.map((edge: any) => {
              const relatedId = edge.source === selectedId ? edge.target : edge.source;
              const related = nodeById.get(relatedId);
              return <p key={edge.id} className="break-all"><span className="text-slate-300">{related ? shortUrl(related.page.url) : relatedId}</span> · {Math.round(edge.weightedJaccard * 100)}% · {t('mapUi.sharedTerms')}: {edge.sharedTerms.join(', ') || '—'}</p>;
            })}
          </div>}
          {selectedOutboundEdges.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-400">
            <p className="font-medium text-emerald-200">{t('mapUi.contentLinksTitle')}</p>
            {selectedOutboundEdges.map((edge: any) => {
              const target = nodeById.get(edge.target);
              return <p key={edge.id} className="break-all"><span className="text-slate-300">{target ? shortUrl(target.page.url) : edge.target}</span>{edge.anchors.length ? ` · „${edge.anchors.join('”, „')}”` : ''} · {edge.links}×</p>;
            })}
          </div>}
          {selectedNode.page.discovery_sources?.length ? <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-400"><p className="font-medium text-sky-200">{t('mapUi.urlDiscovery')}</p>{selectedNode.page.discovery_sources.slice(0, 3).map((source: any, index: number) => <p key={`${source.kind}-${source.source_url || 'none'}-${index}`} className="break-all"><span className="text-sky-200">{discoveryLabel(source.kind, t)}</span>{source.source_url ? ` · ${shortUrl(source.source_url)}` : ''}{source.anchor_text ? ` · „${source.anchor_text}”` : ''}</p>)}</div> : null}
          {selectedNode.orphan && <p className="mt-1 text-[10px] text-amber-300">{t('mapUi.noIncoming', { label: t(linkMode === 'all' ? 'mapUi.internalLink' : 'mapUi.contentLink') })}</p>}
        </> : <p className="text-xs text-slate-500">{t('mapUi.selectNodeHint', { label: t(linkMode === 'all' ? 'mapUi.internalLinks' : 'mapUi.contentLinks') })}</p>}
      </aside>
    </div>
  );
};
