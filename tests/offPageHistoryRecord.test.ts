import { expect, it } from 'vitest';
import { createOffPageHistoryRecord } from '@/services/offPage/historyRecord';
import { offPageHistorySchema } from '@/services/offPage/historySchema';
import { completedAnalysis } from './fixtures/offPageHistory';
import { sourceAnalysis, sourceEvidence, sourceVector } from './fixtures/offPageSources';

it('captures actual model identity, counts, scores and co-citation evidence, never full texts or vectors', () => {
  const record = createOffPageHistoryRecord(completedAnalysis(), { provider: 'local' });
  expect(record).toMatchObject({ scale: 100, embeddingProvider: 'local-hash', embeddingModelId: 'hash-test',
    sourcesRequested: 1, sourcesFetched: 1, sourcesScored: 1, topicLabel: 'SEO',
    tbva: { value: 0.8, status: 'ready', limitations: [] } });
  expect(record.sources[0]).toMatchObject({ similarity: 1, contribution: 0.8 });
  expect(record.coCitations).toEqual([{ sourceUrl: 'https://source.test/page', offset: 0, linked: false, excerpt: 'Acme SEO' }]);
  expect(JSON.stringify(record)).not.toMatch(/Private full text|"vector"|"topic"|"text"/u);
  expect(offPageHistorySchema.safeParse(record).success).toBe(true);
  expect(record.coCitations.every((hit) => hit.excerpt.length <= 300)).toBe(true);
});

it('preserves unavailable evidence rather than zero and never invents a model', () => {
  const record = createOffPageHistoryRecord(sourceAnalysis(), { provider: 'ollama', ollamaModel: 'requested-only' });
  expect(record.embeddingProvider).toBe('ollama');
  expect(record.embeddingModelId).toBeNull();
  expect(record.tbva).toEqual({ value: null, status: 'unavailable', limitations: ['no-topic-vector'] });
  expect(record.sources[0]).toMatchObject({ similarity: null, contribution: null });
  expect(offPageHistorySchema.safeParse(record).success).toBe(true);
});

it.each([
  { vector: null }, { vector: sourceVector(0, 0) }, { vector: sourceVector(1) },
  { vector: sourceVector(NaN, 0) }, { availability: 'blocked' as const, vector: null },
])('keeps unusable vectors unscored: $availability', (overrides) => {
  const analysis = completedAnalysis();
  analysis.sources[0] = { ...analysis.sources[0], ...overrides };
  const record = createOffPageHistoryRecord(analysis, { provider: 'local' });
  expect(record.sources[0]).toMatchObject({ similarity: null, contribution: null });
  expect(offPageHistorySchema.safeParse(record).success).toBe(true);
});

it.each([null, NaN, Infinity])('leaves missing/nonfinite authority %s unknown while retaining similarity', (authority) => {
  const analysis = completedAnalysis();
  analysis.sources[0].authority = authority;
  const record = createOffPageHistoryRecord(analysis, { provider: 'local' });
  expect(record.sources[0]).toMatchObject({ authority: null, similarity: 1, contribution: null });
  expect(record.sourcesScored).toBe(0);
  expect(offPageHistorySchema.safeParse(record).success).toBe(true);
});

it.each([{ authority: -20, vector: sourceVector(1, 0), contribution: 0 },
  { authority: 120, vector: sourceVector(1, 0), contribution: 1 },
  { authority: 80, vector: sourceVector(-1, 0), contribution: 0 }])('uses TBVA clamping for $authority', ({ authority, vector, contribution }) => {
  const analysis = completedAnalysis();
  analysis.sources[0] = { ...analysis.sources[0], authority, vector };
  const record = createOffPageHistoryRecord(analysis, { provider: 'local' });
  expect(record.sources[0].contribution).toBe(contribution);
  expect(record.tbva.value).toBe(contribution);
});

it('handles no selected sources and partial scoring', () => {
  const empty = createOffPageHistoryRecord({ ...completedAnalysis(), sources: [] }, { provider: 'local' });
  expect(empty.sourcesRequested).toBe(0);
  expect(empty.tbva.limitations).toEqual(['no-follow-links']);
  const analysis = completedAnalysis();
  analysis.sources.push(sourceEvidence({ sourceUrl: 'https://other.test', availability: 'blocked' }));
  const record = createOffPageHistoryRecord(analysis, { provider: 'local' });
  expect(record).toMatchObject({ sourcesRequested: 2, sourcesFetched: 1, sourcesScored: 1, tbva: { status: 'partial' } });
});
