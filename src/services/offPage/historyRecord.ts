import { cosine } from '@/services/embeddings/vector';
import { findCoCitations } from './cocitation';
import type { OffPageHistoryRecord } from './historySchema';
import type { SourceEmbeddingSettings } from './sourceEmbeddings';
import { sourceParagraphs } from './sourceParagraphs';
import { usableVector, type SourceAnalysis } from './sources';
import { computeTbva } from './tbva';

export const createOffPageHistoryRecord = (analysis: SourceAnalysis, settings: SourceEmbeddingSettings): OffPageHistoryRecord => {
  const scale = 100;
  const report = computeTbva(analysis.sources.map((source) => ({ ...source, follow: true })), { scale, topic: analysis.topic });
  const citations = findCoCitations(sourceParagraphs(analysis.sources), analysis.aliases, analysis.coreEntity);
  const sources = analysis.sources.map((source) => {
    const similarity = source.availability === 'ok' && usableVector(analysis.topic) && usableVector(source.vector)
      && source.vector.length === analysis.topic.length ? Math.min(1, Math.max(0, cosine(source.vector, analysis.topic))) : null;
    const authority = source.authority !== null && Number.isFinite(source.authority) ? source.authority : null;
    return {
      sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, availability: source.availability, authority, similarity,
      contribution: similarity !== null && authority !== null ? Math.min(1, Math.max(0, authority / scale)) * similarity : null,
    };
  });
  return {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), scale,
    embeddingProvider: analysis.embedding?.provider ?? settings.provider,
    embeddingModelId: analysis.embedding?.modelId ?? null,
    sourcesRequested: sources.length, sourcesFetched: sources.filter((source) => source.availability === 'ok').length,
    sourcesScored: report.counted, tbva: { value: report.tbva, status: report.status, limitations: report.limitations },
    topicLabel: analysis.coreEntity, sources,
    coCitations: [...citations.linked, ...citations.unlinked].map(({ sourceUrl, offset, excerpt, linked }) => ({
      sourceUrl, offset, excerpt: excerpt.slice(0, 300), linked,
    })),
  };
};
