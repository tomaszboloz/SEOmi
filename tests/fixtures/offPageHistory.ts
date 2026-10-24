import type { OffPageHistoryRecord } from '@/services/offPage/historySchema';
import { sourceAnalysis, sourceEvidence, sourceVector } from './offPageSources';

export const historyRecord = (overrides: Partial<OffPageHistoryRecord> = {}): OffPageHistoryRecord => ({
  id: 'record', createdAt: '2026-10-24T10:00:00.000Z', scale: 100,
  embeddingProvider: 'local-hash', embeddingModelId: 'hash-test', topicLabel: 'SEO',
  sourcesRequested: 1, sourcesFetched: 1, sourcesScored: 1,
  tbva: { value: 0.8, status: 'ready', limitations: [] },
  sources: [{ sourceUrl: 'https://source.test/page', fetchedAt: '2026-10-24T09:00:00.000Z',
    availability: 'ok', authority: 80, similarity: 1, contribution: 0.8 }],
  coCitations: [{ sourceUrl: 'https://source.test/page', offset: 0, excerpt: 'Acme SEO', linked: false }],
  ...overrides,
});

export const completedAnalysis = () => ({
  ...sourceAnalysis([sourceEvidence({ availability: 'ok', fetchedAt: '2026-10-24T09:00:00.000Z',
    text: 'Acme SEO\nPrivate full text never stored', vector: sourceVector(1, 0) })]),
  topic: sourceVector(1, 0), embedding: { provider: 'local-hash', modelId: 'hash-test' },
});
