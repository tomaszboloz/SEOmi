import { useState, type MutableRefObject } from 'react';
import type { TFunction } from 'i18next';
import {
  importCrawlClusters,
  importTopicalQueries,
  updateManualTopicalQueries,
  type TopicalMapDocument,
  type TopicalNode,
} from '@/services/topicalMap';
import type { SemanticMap } from '@/services/semanticMap';
import type { CrawledPageSummary } from '@/types';
import { useToolsStore } from '@/stores/toolsStore';

interface Props {
  documentRef: MutableRefObject<TopicalMapDocument>;
  selectedNode: TopicalNode | null;
  graph: SemanticMap;
  pages: CrawledPageSummary[];
  runId: string;
  persist: (next: TopicalMapDocument) => void;
  setSelectedId: (id: string | null) => void;
  updateNode: (nodeId: string, update: Partial<TopicalNode>) => void;
  t: TFunction;
}

export const useTopicalImports = ({
  documentRef,
  selectedNode,
  graph,
  pages,
  runId,
  persist,
  setSelectedId,
  updateNode,
  t,
}: Props) => {
  const [queryImportNotice, setQueryImportNotice] = useState('');

  const keywordResults = useToolsStore((state) => state.keywordResults);
  const keywordResultsSource = useToolsStore((state) => state.keywordResultsSource);
  const isKeywordLoading = useToolsStore((state) => state.isKeywordLoading);
  const gscData = useToolsStore((state) => state.gscData);
  const gscDataFetchedAt = useToolsStore((state) => state.gscDataFetchedAt);
  const gscProperty = useToolsStore((state) => state.gscProperty);

  const importClusters = () => {
    const next = importCrawlClusters(documentRef.current, graph, pages, runId);
    const imported = next.nodes.find(
      (node) =>
        !documentRef.current.nodes.some((current) => current.id === node.id),
    );
    persist(next);
    if (imported) setSelectedId(imported.id);
  };

  const importQueryEvidence = (source: 'dataforseo' | 'gsc') => {
    if (!selectedNode) return;
    const input =
      source === 'dataforseo' && keywordResultsSource
        ? keywordResults.map((item) => ({
            text: item.keyword,
            source: {
              provider:
                'DataForSEO Google Ads Keywords for Keywords Live' as const,
              ...keywordResultsSource,
              searchVolume: item.sourceMetrics?.searchVolume ?? null,
              cpc: item.sourceMetrics?.cpc ?? null,
              competitionIndex: item.sourceMetrics?.competitionIndex ?? null,
              searchIntent: item.sourceMetrics?.intent ?? null,
              monthlySearches: item.sourceMetrics?.monthlySearches ?? [],
            },
          }))
        : source === 'gsc' && gscData && gscDataFetchedAt
          ? gscData.queries.map((item) => ({
              text: item.query,
              source: {
                provider: 'Google Search Console' as const,
                retrievedAt: gscDataFetchedAt,
                propertyUrl: gscData.site_url || gscProperty,
                startDate: gscData.start_date,
                endDate: gscData.end_date,
                clicks: item.clicks,
                impressions: item.impressions,
                ctr: item.ctr,
                position: item.position,
                queryRowsMayBeTruncated: gscData.queries_may_be_truncated,
                maxRowsPerDimension: gscData.max_rows_per_dimension,
              },
            }))
          : [];
    if (!input.length) return;
    const imported = importTopicalQueries(
      documentRef.current,
      selectedNode.id,
      input,
    );
    if (imported.document !== documentRef.current) persist(imported.document);
    const details = [
      t('semanticWorkspace.importAdded', {
        count: imported.addedCount,
        source:
          source === 'gsc'
            ? t('semanticWorkspace.sourceGsc')
            : t('semanticWorkspace.sourceDataForSeo'),
      }),
      imported.updatedCount
        ? t('semanticWorkspace.importUpdated', { count: imported.updatedCount })
        : '',
      imported.duplicateCount > imported.updatedCount
        ? t('semanticWorkspace.importSkipped', {
            count: imported.duplicateCount - imported.updatedCount,
          })
        : '',
      imported.limitReached ? t('semanticWorkspace.importLimit') : '',
      source === 'gsc' && gscData?.queries_may_be_truncated
        ? t('semanticWorkspace.importTruncated')
        : '',
    ].filter(Boolean);
    setQueryImportNotice(details.join(' '));
  };

  const updateManualQueries = (value: string) => {
    if (!selectedNode) return;
    const result = updateManualTopicalQueries(selectedNode, value);
    updateNode(selectedNode.id, { queries: result.queries });
    setQueryImportNotice(
      result.limitReached ? t('semanticWorkspace.manualQueryLimit') : '',
    );
  };

  return {
    importClusters,
    importQueryEvidence,
    updateManualQueries,
    queryImportNotice,
    setQueryImportNotice,
    keywordResults,
    keywordResultsSource,
    isKeywordLoading,
    gscData,
    gscDataFetchedAt,
    gscProperty,
  };
};
