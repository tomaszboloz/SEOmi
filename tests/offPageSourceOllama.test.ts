import { beforeEach, expect, it, vi } from 'vitest';
import { createProvider } from '@/services/embeddings/registry';
import { embedSources } from '@/services/offPage/sourceEmbeddings';
import { buildOffPageReports } from '@/components/Domain/backlinkChecker/useOffPageReports';
import { deferredSource, sourceAnalysis, sourceEvidence, sourceVector } from './fixtures/offPageSources';
import type { Vector } from '@/services/embeddings/types';

vi.mock('@/services/embeddings/registry', () => ({ createProvider: vi.fn() }));
const embed = vi.fn();
const input = () => sourceAnalysis(Array.from({ length: 5 }, (_, index) => sourceEvidence({
  sourceUrl: `https://site${index}.test`, availability: 'ok', text: `source${index}`,
})));
beforeEach(() => {
  embed.mockReset();
  vi.mocked(createProvider).mockReset().mockReturnValue({ id: 'ollama', model: 'fixed', embed });
});
it('isolates Ollama failures, mixed dimensions, zero vectors and bad cardinality as unscored sources', async () => {
  embed.mockImplementation(async ([text]: string[]) => {
    if (text === 'source1') throw new Error('invalid embedding for this source');
    if (text === 'source2') return [sourceVector(1)];
    if (text === 'source3') return [sourceVector(0, 0)];
    if (text === 'source4') return [];
    return [sourceVector(1, 0)];
  });
  const result = await embedSources(input(), 'SEO', { provider: 'ollama' }, new AbortController().signal);
  expect(result.sources.map((source) => source.vector)).toEqual([sourceVector(1, 0), null, null, null, null]);
  expect(buildOffPageReports(null, result).tbva).toMatchObject({ status: 'partial', counted: 1, unscored: 4 });
  expect(embed).toHaveBeenCalledTimes(6);
  embed.mockResolvedValue([]);
  expect((await embedSources(input(), 'SEO', { provider: 'ollama' }, new AbortController().signal)).topic).toBeNull();
});
it('embeds at most three sources concurrently after embedding the topic', async () => {
  const pending = Array.from({ length: 5 }, () => deferredSource<Vector[]>());
  let active = 0;
  let maximum = 0;
  embed.mockImplementation(([text]: string[]) => {
    if (text === 'SEO') return Promise.resolve([sourceVector(1, 0)]);
    active += 1;
    maximum = Math.max(maximum, active);
    return pending[Number(text.slice(-1))].promise.finally(() => { active -= 1; });
  });
  const result = embedSources(input(), 'SEO', { provider: 'ollama' }, new AbortController().signal);
  await vi.waitFor(() => expect(embed).toHaveBeenCalledTimes(4));
  pending[0].resolve([sourceVector(1, 0)]);
  pending[1].resolve([sourceVector(1, 0)]);
  await vi.waitFor(() => expect(embed).toHaveBeenCalledTimes(6));
  pending.slice(2).forEach((request) => request.resolve([sourceVector(1, 0)]));
  expect((await result).sources.every((source) => source.vector !== null)).toBe(true);
  expect(maximum).toBe(3);
});
it('propagates cancellation and handles a topic without any available source text', async () => {
  const controller = new AbortController();
  embed.mockImplementation(async ([text]: string[]) => {
    if (text === 'source0') controller.abort();
    return [sourceVector(1, 0)];
  });
  await expect(embedSources(input(), 'SEO', { provider: 'ollama' }, controller.signal)).rejects.toThrow();
  embed.mockResolvedValue([sourceVector(1, 0)]);
  expect((await embedSources(sourceAnalysis([]), 'SEO', { provider: 'ollama' }, new AbortController().signal)).topic).toEqual(sourceVector(1, 0));
});
