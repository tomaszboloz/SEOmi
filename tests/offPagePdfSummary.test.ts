import { beforeEach, expect, it } from 'vitest';
import { loadOffPageHistory, offPageHistoryKey, saveOffPageHistory } from '@/services/offPage/history';
import { crawlOffPageSummary } from '@/services/offPage/summary';
import { createCrawlRunFixture } from './fixtures/crawl';
import { historyRecord } from './fixtures/offPageHistory';

const run = createCrawlRunFixture({ projectId: 'report-project' });
beforeEach(() => localStorage.clear());

it('omits off-page data without a project or a valid project-local saved record', () => {
  expect(crawlOffPageSummary(createCrawlRunFixture())).toBeUndefined();
  expect(crawlOffPageSummary(run)).toBeUndefined();
  saveOffPageHistory('another-project', historyRecord());
  expect(crawlOffPageSummary(run)).toBeUndefined();
  localStorage.setItem(offPageHistoryKey('report-project'), '[{"id":"invalid"}]');
  expect(crawlOffPageSummary(run)).toBeUndefined();
});

it('loads the latest record, retaining model, scale, topic, counts and raw limitation keys', () => {
  saveOffPageHistory('report-project', historyRecord({ id: 'older', createdAt: '2026-10-01T00:00:00.000Z' }));
  saveOffPageHistory('report-project', historyRecord({
    topicLabel: 'Latest topic', scale: 10,
    tbva: { value: 0.8, status: 'partial', limitations: ['source-text-or-authority-missing'] },
  }));
  expect(crawlOffPageSummary(run)).toEqual({
    scale: 10, embedding_provider: 'local-hash', embedding_model_id: 'hash-test', topic_label: 'Latest topic',
    sources_requested: 1, sources_fetched: 1, sources_scored: 1,
    tbva: { value: 0.8, status: 'partial', limitations: ['source-text-or-authority-missing'] },
    sources: [{ url: 'https://source.test/page', authority: 80, similarity: 1, contribution: 0.8 }],
    co_citations: [{ url: 'https://source.test/page', offset: 0, excerpt: 'Acme SEO' }],
  });
});

it('ranks the top ten sources by contribution and caps co-citations without mutating history', () => {
  const sources = Array.from({ length: 15 }, (_, index) => ({
    ...historyRecord().sources[0], sourceUrl: `https://source-${index}.test/`, contribution: index / 20,
  }));
  const coCitations = sources.map((source, index) => ({
    sourceUrl: source.sourceUrl, offset: index * 100, excerpt: 'نص عربي 你好 😀', linked: false,
  }));
  saveOffPageHistory('report-project', historyRecord({ sources, coCitations, sourcesRequested: 15, sourcesFetched: 15, sourcesScored: 15 }));
  const before = loadOffPageHistory('report-project');
  const summary = crawlOffPageSummary(run)!;
  expect(summary.sources.map((source) => source.contribution)).toEqual([0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25]);
  expect(summary.co_citations).toHaveLength(5);
  expect(summary.co_citations[4]).toEqual({ url: sources[4].sourceUrl, offset: 400, excerpt: 'نص عربي 你好 😀' });
  summary.tbva.limitations.push('new-code');
  expect(loadOffPageHistory('report-project')).toEqual(before);
});

it.each(['ready', 'partial', 'unavailable'] as const)('preserves null and measured zero metrics for %s evidence', (status) => {
  const scored = { ...historyRecord().sources[0], authority: 0, similarity: 0, contribution: 0 };
  const missing = { ...scored, sourceUrl: 'https://missing.test', availability: null, authority: null, similarity: null, contribution: null };
  const unavailable = status === 'unavailable';
  saveOffPageHistory('report-project', historyRecord({
    embeddingModelId: null, sources: [missing, scored, { ...missing, sourceUrl: 'https://missing2.test' }],
    sourcesRequested: 3, sourcesFetched: 1, sourcesScored: 1,
    tbva: { value: unavailable ? null : 0, status, limitations: unavailable ? ['no-topic-vector'] : [] },
  }));
  const summary = crawlOffPageSummary(run)!;
  expect(summary.embedding_model_id).toBeNull();
  expect(summary.tbva.value).toBe(unavailable ? null : 0);
  expect(summary.tbva.status).toBe(status);
  expect(summary.sources[0]).toMatchObject({ authority: 0, similarity: 0, contribution: 0 });
  expect(summary.sources[1]).toMatchObject({ authority: null, similarity: null, contribution: null });
});

it('bounds long Unicode/RTL URLs, topic and model identifiers without splitting surrogate pairs', () => {
  const url = `https://example.test/${'😀مرحبا'.repeat(100)}`;
  saveOffPageHistory('report-project', historyRecord({
    topicLabel: '😀'.repeat(300), embeddingProvider: '😀'.repeat(150), embeddingModelId: '😀'.repeat(150),
    sources: [{ ...historyRecord().sources[0], sourceUrl: url }],
    coCitations: [{ sourceUrl: url, offset: 999, excerpt: 'ش'.repeat(300), linked: true }],
  }));
  const summary = crawlOffPageSummary(run)!;
  for (const text of [summary.sources[0].url, summary.co_citations[0].url, summary.topic_label]) {
    expect(Array.from(text)).toHaveLength(240);
    expect(text.endsWith('…')).toBe(true);
    expect(text).not.toContain('\uFFFD');
  }
  expect(Array.from(summary.embedding_provider)).toHaveLength(120);
  expect(Array.from(summary.embedding_model_id!)).toHaveLength(120);
  expect(summary.co_citations[0].excerpt).toHaveLength(300);
});

it('keeps a saved unavailable analysis even when it has no source rows or citations', () => {
  saveOffPageHistory('report-project', historyRecord({
    sources: [], coCitations: [], sourcesRequested: 0, sourcesFetched: 0, sourcesScored: 0,
    tbva: { value: null, status: 'unavailable', limitations: ['no-follow-links'] },
  }));
  expect(crawlOffPageSummary(run)).toMatchObject({
    tbva: { value: null, status: 'unavailable', limitations: ['no-follow-links'] }, sources: [], co_citations: [],
  });
});
