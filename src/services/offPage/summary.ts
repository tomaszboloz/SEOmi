import type { CrawlRunRecord } from '@/types';
import { loadOffPageHistory } from './history';
import type { OffPageHistoryRecord } from './historySchema';

export const OFF_PAGE_PDF_SOURCES = 10;
export const OFF_PAGE_PDF_CITATIONS = 5;

export interface OffPagePdfSummary {
  scale: number;
  embedding_provider: string;
  embedding_model_id: string | null;
  topic_label: string;
  sources_requested: number;
  sources_fetched: number;
  sources_scored: number;
  tbva: OffPageHistoryRecord['tbva'];
  sources: Array<{ url: string; authority: number | null; similarity: number | null; contribution: number | null }>;
  co_citations: Array<{ url: string; offset: number; excerpt: string }>;
}

const bounded = (text: string, limit: number): string => {
  const characters = Array.from(text);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : text;
};

export const crawlOffPageSummary = (run: CrawlRunRecord): OffPagePdfSummary | undefined => {
  if (!run.projectId) return undefined;
  const record = loadOffPageHistory(run.projectId)[0];
  if (!record) return undefined;
  return {
    scale: record.scale,
    embedding_provider: bounded(record.embeddingProvider, 120),
    embedding_model_id: record.embeddingModelId === null ? null : bounded(record.embeddingModelId, 120),
    topic_label: bounded(record.topicLabel, 240),
    sources_requested: record.sourcesRequested,
    sources_fetched: record.sourcesFetched,
    sources_scored: record.sourcesScored,
    tbva: { ...record.tbva, limitations: [...record.tbva.limitations] },
    sources: [...record.sources]
      .sort((left, right) => (right.contribution ?? -1) - (left.contribution ?? -1))
      .slice(0, OFF_PAGE_PDF_SOURCES)
      .map((source) => ({
        url: bounded(source.sourceUrl, 240), authority: source.authority,
        similarity: source.similarity, contribution: source.contribution,
      })),
    co_citations: record.coCitations.slice(0, OFF_PAGE_PDF_CITATIONS).map((hit) => ({
      url: bounded(hit.sourceUrl, 240), offset: hit.offset, excerpt: bounded(hit.excerpt, 300),
    })),
  };
};
