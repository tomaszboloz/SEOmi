import { vi } from 'vitest';
import { createProvider } from '@/services/embeddings/registry';
import type { EmbeddingProvider, Vector } from '@/services/embeddings/types';
import { prePublishContext } from '@/services/prePublish/context';
import { createCrawlPageFixture } from './crawl';
import { createSemanticCrawlRunFixture } from './semanticCrawlRun';

export const draftText = 'Heat pumps provide efficient heating. '.repeat(25);
export const mountRun = (projectId = 'mount-project', id = 'latest', completedAt = '2026-10-24T10:00:00Z') =>
  createSemanticCrawlRunFixture(id, completedAt, projectId, Array.from({ length: 3 }, (_, index) =>
    createCrawlPageFixture({ url: `https://example.test/page-${index}`, final_url: `https://example.test/page-${index}`,
      title: `Heat pump guide ${index}`, word_count: 700, document_language: 'en',
      semantic_excerpts: [`Crawled heating evidence ${index}`],
      focus_terms: ['heat pump', 'heating', 'electricity', 'efficiency'].map((term) => ({ term, surface: term, count: 8, weight: 12 })),
    })));
export const mountContext = () => prePublishContext('mount-project', [mountRun()]);
export const vectorsFor = (texts: string[]): Vector[] => texts.map((_, index) =>
  new Float64Array(index === 1 ? [0.9, Math.sqrt(0.19)] : [1, 0]));
export const mockProvider = (embed: EmbeddingProvider['embed'] = async (texts) => vectorsFor(texts)) => {
  const provider = { id: 'ollama', model: 'test-model', embed: vi.fn<EmbeddingProvider['embed']>(embed) };
  vi.mocked(createProvider).mockReturnValue(provider);
  return provider;
};
export const deferredVectors = () => {
  let resolve!: (vectors: Vector[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Vector[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
