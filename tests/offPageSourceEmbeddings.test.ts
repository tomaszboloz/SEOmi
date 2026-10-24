import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProvider } from '@/services/embeddings/registry';
import { embedSources } from '@/services/offPage/sourceEmbeddings';
import { sourceAnalysis, sourceEvidence, sourceVector } from './fixtures/offPageSources';

vi.mock('@/services/embeddings/registry', () => ({ createProvider: vi.fn() }));
const embed = vi.fn();
const analysis = () => sourceAnalysis([sourceEvidence({ availability: 'ok', text: 'Acme SEO' }),
  sourceEvidence({ sourceUrl: 'https://other.test', availability: 'ok', text: 'Other SEO' }), sourceEvidence()]);
beforeEach(() => {
  embed.mockReset().mockResolvedValue([sourceVector(1, 0), sourceVector(1, 0), sourceVector(0, 1)]);
  vi.mocked(createProvider).mockReset().mockReturnValue({ id: 'local', model: 'hash', embed });
});
describe('source embeddings', () => {
  it('fits one consistent local corpus with topic first and only available source texts', async () => {
    const result = await embedSources(analysis(), 'SEO', { provider: 'local' }, new AbortController().signal);
    expect(embed).toHaveBeenCalledWith(['SEO', 'Acme SEO', 'Other SEO']);
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: 'local', corpus: ['SEO', 'Acme SEO', 'Other SEO'] }));
    expect(result.topic).toEqual(sourceVector(1, 0));
    expect(result.sources.map((source) => source.vector)).toEqual([sourceVector(1, 0), sourceVector(0, 1), null]);
  });
  it.each(['', '   '])('does not invent a missing core %j', async (core) => {
    const input = analysis();
    expect(await embedSources(input, core, { provider: 'local' }, new AbortController().signal)).toBe(input);
    expect(createProvider).not.toHaveBeenCalled();
  });
  it.each(['openai', 'hybrid'])('rejects unapproved provider %s without network or fallback', async (provider) => {
    expect((await embedSources(analysis(), 'SEO', { provider }, new AbortController().signal)).topic).toBeNull();
    expect(createProvider).not.toHaveBeenCalled();
  });
  it.each([[], [[0, 0], [1, 0], [1, 0]], [[NaN], [1], [1]], [[1], [1]]].map((vectors) => ({ vectors })))('rejects invalid topic or result cardinality $vectors', async ({ vectors }) => {
    embed.mockResolvedValue(vectors.map((vector) => Float64Array.from(vector)));
    expect((await embedSources(analysis(), 'SEO', { provider: 'local' }, new AbortController().signal)).topic).toBeNull();
  });
  it('leaves only invalid, mixed-length and zero source vectors unscored', async () => {
    embed.mockResolvedValue([sourceVector(1, 0), sourceVector(0, 0), sourceVector(1)]);
    const result = await embedSources(analysis(), 'SEO', { provider: 'local' }, new AbortController().signal);
    expect(result.topic).toEqual(sourceVector(1, 0));
    expect(result.sources.every((source) => source.vector === null)).toBe(true);
  });
  it('refuses a changed provider identity and isolates provider failures', async () => {
    const provider = { id: 'ollama', model: 'original', embed };
    vi.mocked(createProvider).mockReturnValue(provider);
    embed.mockImplementation(async () => { provider.model = 'changed'; return [[1], [1], [1]]; });
    expect((await embedSources(analysis(), 'SEO', { provider: 'ollama' }, new AbortController().signal)).topic).toBeNull();
    embed.mockRejectedValue(new Error('model missing'));
    expect((await embedSources(analysis(), 'SEO', { provider: 'ollama' }, new AbortController().signal)).topic).toBeNull();
  });
  it('pins Ollama to localhost, forwards abort signals and trims model names without making network calls', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    try {
      await embedSources(analysis(), 'SEO', { provider: 'ollama', ollamaModel: ' model ' }, controller.signal);
      const options = vi.mocked(createProvider).mock.calls[0][0];
      expect(options).toMatchObject({ ollamaUrl: 'http://127.0.0.1:11434', ollamaModel: 'model' });
      await options.fetchImpl!('http://127.0.0.1:11434/api/embed', { method: 'POST' });
      expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
      const inner = new AbortController();
      await options.fetchImpl!('http://127.0.0.1:11434/api/embed', { signal: inner.signal });
      inner.abort();
      expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
      controller.abort();
      expect(() => options.fetchImpl!('unused', {})).toThrow();
    } finally { vi.unstubAllGlobals(); }
  });
  it('propagates abort before and after embedding instead of returning evidence', async () => {
    const controller = new AbortController();
    embed.mockImplementation(async () => { controller.abort(); return [[1], [1], [1]]; });
    await expect(embedSources(analysis(), 'SEO', { provider: 'local' }, controller.signal)).rejects.toThrow();
    await expect(embedSources(analysis(), 'SEO', { provider: 'local' }, controller.signal)).rejects.toThrow();
  });
});
