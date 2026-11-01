import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { DIGEST_CHARS, MAX_DIGESTS, neuralMarketCentroid, NEURAL_TERMS, pageDigest } from '@/services/semanticDecay/neuralCentroid';
import { buildReferenceSnapshot, REFERENCE_DECAY_MODEL } from '@/services/semanticDecay/recordReferenceSnapshot';
import { loadSerpHistory } from '@/services/semanticDecay/snapshotStore';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';
import { COMPETITORS, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));
const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const taxonomy = (terms: Record<string, number>) => ({ ...(referenceTaxonomy(pages) as ReferenceTaxonomy), commonTerms: terms });
const embed = (vectors: number[][]) => vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
  const count = (JSON.parse(String(init.body)).input as string[]).length;
  return new Response(JSON.stringify({ embeddings: vectors.slice(0, count) }), { status: 200 });
});
beforeEach(() => localStorage.clear());

it('averages group embeddings by competitor share and labels the model', async () => {
  const terms = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`term${i}`, 20 - i]));
  const fetchImpl = embed([[1, 0], [0, 1], [1, 1]]);
  const result = await neuralMarketCentroid(taxonomy(terms), { model: ' nomic ', fetchImpl });
  expect(result!.model).toBe('tas-reference-ollama:nomic-v1');
  expect(Math.hypot(...result!.centroid)).toBeCloseTo(1, 6);
  const body = JSON.parse(String(fetchImpl.mock.calls[0][1].body));
  expect(body.model).toBe('nomic');
  expect(body.input).toHaveLength(3);
  expect(body.input[0]).toBe('term0 term1 term2 term3 term4 term5 term6 term7');
  const big = Object.fromEntries(Array.from({ length: NEURAL_TERMS + 40 }, (_, i) => [`t${i}`, 1 + i / 1000]));
  const capped = embed(Array.from({ length: 10 }, () => [1, 0]));
  await neuralMarketCentroid(taxonomy(big), { model: 'm', fetchImpl: capped });
  expect(JSON.parse(String(capped.mock.calls[0][1].body)).input).toHaveLength(NEURAL_TERMS / 8);
});

const textPage = (title: string | null, paragraphs: string[] = [], description: string | null = null) =>
  ({ url: `https://c.test/${title}`, title, meta_description: description, rag_sections: [{ heading: '', level: 0, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 }] }) as never;
const rival = (pages: unknown[], domain = 'c.test') => ({ domain, pages }) as never;

it('digests a page from title, description and lead paragraphs within the cap', () => {
  expect(pageDigest(textPage('Coffee guide', ['  Brew   with\nwater ', 'Grind fresh'], 'All about coffee'))).toBe('Coffee guide All about coffee Brew with water Grind fresh');
  expect(pageDigest(textPage(null))).toBe('');
  expect(pageDigest({ url: 'u' } as never)).toBe('');
  expect(pageDigest(textPage('x', ['y'.repeat(DIGEST_CHARS * 2)]))).toHaveLength(DIGEST_CHARS);
});

it('embeds page digests when enough competitor text exists and labels the input', async () => {
  const pages = ['a', 'b', 'c', 'd'].map((name) => textPage(`Page ${name}`, [`Text of ${name}`]));
  const fetchImpl = embed([[1, 0], [0, 1], [1, 1], [2, 1]]);
  const result = await neuralMarketCentroid(taxonomy({ coffee: 1 }), { model: 'nomic', competitors: [rival(pages.slice(0, 2)), rival(pages.slice(2), 'd.test')], fetchImpl });
  expect(result!.model).toBe('tas-reference-ollama:nomic-pages-v1');
  const input = JSON.parse(String(fetchImpl.mock.calls[0][1].body)).input as string[];
  expect(input).toEqual(['Page a Text of a', 'Page b Text of b', 'Page c Text of c', 'Page d Text of d']);
  expect(Math.hypot(...result!.centroid)).toBeCloseTo(1, 6);
});

it('caps pages per competitor and total digests, and falls back to vocabulary with too little text', async () => {
  const many = Array.from({ length: 10 }, (_, i) => textPage(`P${i}`, ['t']));
  const fetchImpl = embed(Array.from({ length: MAX_DIGESTS }, () => [1, 0]));
  await neuralMarketCentroid(taxonomy({ coffee: 1 }), { model: 'm', competitors: Array.from({ length: 20 }, (_, i) => rival(many, `d${i}.test`)), fetchImpl });
  const input = JSON.parse(String(fetchImpl.mock.calls[0][1].body)).input as string[];
  expect(input).toHaveLength(MAX_DIGESTS);
  expect(input.filter((text) => text.startsWith('P3'))).toHaveLength(0);
  const sparse = embed([[1, 0]]);
  const fallback = await neuralMarketCentroid(taxonomy({ coffee: 1 }), { model: 'm', competitors: [rival([textPage('only one', ['text']), textPage(null)])], fetchImpl: sparse });
  expect(fallback!.model).toBe('tas-reference-ollama:m-v1');
  expect(JSON.parse(String(sparse.mock.calls[0][1].body)).input).toEqual(['coffee']);
  expect(await neuralMarketCentroid(taxonomy({}), { model: 'm', competitors: [rival([textPage(null)])], fetchImpl: embed([[1, 0]]) })).toBeNull();
});

it('orders equal shares by term so the request is deterministic', async () => {
  const fetchImpl = embed([[1, 0]]);
  await neuralMarketCentroid(taxonomy({ beta: 1, alpha: 1, gamma: 1 }), { model: 'm', fetchImpl });
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body)).input).toEqual(['alpha beta gamma']);
});

it('declines without a model, terms, usable vectors or after cancellation', async () => {
  expect(await neuralMarketCentroid(taxonomy({ a: 1 }), { model: ' ' })).toBeNull();
  expect(await neuralMarketCentroid(taxonomy({ a: 0, b: Number.NaN }), { model: 'm' })).toBeNull();
  expect(await neuralMarketCentroid(taxonomy({ a: 1 }), { model: 'm', fetchImpl: embed([[0, 0]]) })).toBeNull();
  await expect(neuralMarketCentroid(taxonomy({ a: 1 }), { model: 'm', fetchImpl: embed([[Number.NaN, 1]]) })).rejects.toThrow('invalid embedding');
  const aborted = new AbortController();
  const fetchImpl = vi.fn().mockImplementation(async () => { aborted.abort(); return new Response(JSON.stringify({ embeddings: [[1, 0]] }), { status: 200 }); });
  await expect(neuralMarketCentroid(taxonomy({ a: 1 }), { model: 'm', fetchImpl, signal: aborted.signal })).rejects.toThrow();
});

it('snapshots use the neural centroid and model label when given, the lexical one otherwise', () => {
  const serp = [{ query: 'coffee', source: 'dataforseo', hits: [{ url: 'https://rival-one.test/', rank: 1, domain: 'rival-one.test' }] }];
  const base = taxonomy({ coffee: 1 });
  const market = { country: 'DE', language: 'de' };
  const neural = buildReferenceSnapshot(base, serp, market, { centroid: new Float64Array([0, 1]), model: 'tas-reference-ollama:m-v1' })!;
  expect(neural).toMatchObject({ model: 'tas-reference-ollama:m-v1' });
  expect([...neural.centroid!]).toEqual([0, 1]);
  expect(buildReferenceSnapshot(base, serp, market)!.model).toBe(REFERENCE_DECAY_MODEL);
});

const run = async (neuralSession: boolean, fetchImpl?: typeof fetch) => {
  if (neuralSession) localStorage.setItem('seomi_project_neural-p_embedding_clustering_v1', JSON.stringify({ provider: 'ollama', ollamaModel: 'nomic' }));
  if (fetchImpl) vi.stubGlobal('fetch', fetchImpl);
  const tax = referenceTaxonomy(pages) as ReferenceTaxonomy;
  const serp = [{ query: 'coffee', source: 'dataforseo', hits: [{ url: 'https://rival-one.test/', rank: 1, domain: 'rival-one.test' }] }];
  const runner = vi.fn(async () => ({ status: 'ok' as const, taxonomy: tax, competitors: COMPETITORS, serp }));
  const { result } = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: ownReport(pages), projectId: 'neural-p', runner, market: () => ({ country: 'DE', language: 'de' }) }));
  await act(async () => { await result.current.build(); });
  vi.unstubAllGlobals();
  return loadSerpHistory('neural-p').snapshots;
};

it('records a neural snapshot when the project uses an Ollama model and falls back to lexical on failure', async () => {
  const ok = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const count = (JSON.parse(String(init.body)).input as string[]).length;
    return new Response(JSON.stringify({ embeddings: Array.from({ length: count }, () => [1, 2]) }), { status: 200 });
  });
  expect((await run(true, ok as unknown as typeof fetch))[0].model).toBe('tas-reference-ollama:nomic-pages-v1');
  localStorage.clear();
  const down = vi.fn().mockRejectedValue(new Error('down'));
  expect((await run(true, down as unknown as typeof fetch))[0].model).toBe(REFERENCE_DECAY_MODEL);
  localStorage.clear();
  expect((await run(false))[0].model).toBe(REFERENCE_DECAY_MODEL);
});
