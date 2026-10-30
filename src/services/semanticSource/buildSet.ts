import type { EmbeddingProvider } from '@/services/embeddings/types';
import { withTimeout } from './providerErrors';
import { safeCosine } from './similarity';
import type { EmbeddingSet } from './types';

export interface EmbeddingSetInput {
  /** Page text keyed by normalized URL. */
  pages?: ReadonlyMap<string, string>;
  /** Term key to the text that is embedded for it (usually its surface form). */
  terms?: ReadonlyMap<string, string>;
  batchSize?: number;
  signal?: AbortSignal;
  /** Per-batch timeout in ms (#86 GEM-86-03); a slow provider rejects with a TimeoutError. */
  timeoutMs?: number;
  /** Budget: at most this many texts are embedded; the rest is reported as `skipped`, never scored. */
  maxEntries?: number;
}

export interface EmbeddingSetResult {
  /** Null when the provider produced no usable vector: callers stay on `tfidf-only`. */
  set: EmbeddingSet | null;
  /** Entries dropped for a wrong dimension, NaN/Infinity or a zero vector. */
  rejected: number;
  /** Entries requested in total. */
  requested: number;
  /** Entries left out by the `maxEntries` budget. */
  skipped: number;
}

const DEFAULT_BATCH = 32;

const abortError = (): Error => Object.assign(new Error('Embedding request cancelled'), { name: 'AbortError' });

/**
 * Embeds pages and terms once with one provider/model, in batches that can be cancelled between calls.
 * Provider errors (Ollama missing, offline, wrong model) propagate; the caller then keeps TF-IDF only.
 */
export const buildEmbeddingSet = async (provider: EmbeddingProvider, input: EmbeddingSetInput): Promise<EmbeddingSetResult> => {
  const entries: Array<{ bucket: 'byUrl' | 'byTerm'; key: string; text: string }> = [
    ...[...(input.pages ?? new Map<string, string>())].map(([key, text]) => ({ bucket: 'byUrl' as const, key, text })),
    ...[...(input.terms ?? new Map<string, string>())].map(([key, text]) => ({ bucket: 'byTerm' as const, key, text })),
  ].filter((entry) => entry.text.trim() !== '');
  const budget = input.maxEntries === undefined ? entries.length : Math.max(0, Math.floor(input.maxEntries));
  const skipped = Math.max(0, entries.length - budget);
  entries.splice(budget);
  const size = Math.max(1, Math.floor(input.batchSize ?? DEFAULT_BATCH));
  const vectors: Array<ArrayLike<number> | undefined> = [];
  for (let start = 0; start < entries.length; start += size) {
    if (input.signal?.aborted) throw abortError();
    const batch = entries.slice(start, start + size);
    const result = await withTimeout(provider.embed(batch.map((entry) => entry.text)), input.timeoutMs, input.signal);
    if (input.signal?.aborted) throw abortError();
    batch.forEach((_, index) => vectors.push(result[index]));
  }
  const dimensions = vectors.find((vector) => vector && safeCosine(vector, vector) !== null)?.length ?? 0;
  const byUrl = new Map<string, ArrayLike<number>>();
  const byTerm = new Map<string, ArrayLike<number>>();
  let rejected = 0;
  entries.forEach((entry, index) => {
    const vector = vectors[index];
    if (!vector || vector.length !== dimensions || safeCosine(vector, vector) === null) { rejected += 1; return; }
    (entry.bucket === 'byUrl' ? byUrl : byTerm).set(entry.key, vector);
  });
  const usable = byUrl.size + byTerm.size;
  return {
    set: usable ? { providerId: provider.id, model: provider.model, dimensions, byUrl, byTerm } : null,
    rejected,
    requested: entries.length + skipped,
    skipped,
  };
};
