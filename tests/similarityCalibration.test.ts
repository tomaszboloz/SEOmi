import { describe, expect, it } from 'vitest';
import { createProvider } from '@/services/embeddings/registry';
import { DEFAULT_SIMILARITY_THRESHOLDS, safeCosine, similarityThreshold, describeModel } from '@/services/semanticSource';

/**
 * D02 calibration on a pinned fixture (#86). The local-hash provider is deterministic and offline, so its
 * threshold can be verified in CI. Neural and hybrid thresholds are documented defaults for
 * nomic-embed-text style models; they need a real Ollama and are checked by the manual protocol in
 * .github/SEMANTIC_SOURCES.md, never silently reused for another model.
 */
const RELATED: Array<[string, string]> = [
  ['blood glucose meter for diabetes', 'glucose meter for diabetes testing'],
  ['best running shoes for marathon', 'marathon running shoes guide'],
  ['how to bake sourdough bread', 'sourdough bread baking tips'],
  ['mortgage interest rates', 'interest rates on a mortgage'],
];
const UNRELATED: Array<[string, string]> = [
  ['blood glucose meter for diabetes', 'marathon running shoes guide'],
  ['how to bake sourdough bread', 'mortgage interest rates'],
  ['best running shoes for marathon', 'sourdough bread baking tips'],
  ['mortgage interest rates', 'glucose meter for diabetes testing'],
];

const cosines = async (pairs: Array<[string, string]>) => {
  const corpus = [...RELATED, ...UNRELATED].flat();
  const provider = createProvider({ provider: 'local', corpus });
  const out: number[] = [];
  for (const [a, b] of pairs) {
    const [va, vb] = await provider.embed([a, b]);
    out.push(safeCosine(va, vb) ?? Number.NaN);
  }
  return out;
};

describe('similarity threshold calibration (D02)', () => {
  it('local-hash threshold 0.12 separates related from unrelated on the fixture', async () => {
    const threshold = similarityThreshold(describeModel({ id: 'local', model: 'hash' }, 256))!;
    expect(threshold).toBe(0.12);
    expect((await cosines(RELATED)).every((value) => value >= threshold)).toBe(true);
    expect((await cosines(UNRELATED)).every((value) => value < threshold)).toBe(true);
  });

  it('publishes one threshold per kind and none for an uncalibrated kind', () => {
    expect(DEFAULT_SIMILARITY_THRESHOLDS).toEqual({ 'local-hash': 0.12, neural: 0.6, hybrid: 0.35 });
    expect(similarityThreshold(describeModel({ id: 'tfidf', model: 't' }, 8))).toBeNull();
  });
});
