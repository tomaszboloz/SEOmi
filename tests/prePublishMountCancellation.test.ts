import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createProvider } from '@/services/embeddings/registry';
import { checkPrePublish } from '@/services/prePublish/embeddingCheck';
import { deferredVectors, draftText, mockProvider, mountContext, vectorsFor } from './fixtures/prePublishMount';

vi.mock('@/services/embeddings/registry', async (original) => ({
  ...await original<typeof import('@/services/embeddings/registry')>(), createProvider: vi.fn(),
}));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mockProvider(); });
afterEach(() => vi.unstubAllGlobals());
const settings = { provider: 'ollama' };
it('does not start a cancelled request', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(checkPrePublish(draftText, '', mountContext(), settings, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(createProvider).not.toHaveBeenCalled();
});
it('rejects late embeddings after cancellation even if the provider ignores abort', async () => {
  const task = deferredVectors();
  const provider = mockProvider(vi.fn(() => task.promise));
  const abort = new AbortController();
  const result = checkPrePublish(draftText, '', mountContext(), settings, abort.signal);
  abort.abort();
  task.resolve(vectorsFor(provider.embed.mock.calls[0][0]));
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
});
it.each([false, true])('forwards cancellation to existing provider HTTP transport (timeout signal: %s)', async (withTimeout) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  const abort = new AbortController();
  await checkPrePublish(draftText, '', mountContext(), settings, abort.signal);
  const fetchImpl = vi.mocked(createProvider).mock.calls[0][0].fetchImpl!;
  const timeout = new AbortController();
  await fetchImpl('http://127.0.0.1:11434/api/embed', { method: 'POST', ...(withTimeout ? { signal: timeout.signal } : {}) });
  const forwarded = fetchMock.mock.calls[0][1].signal as AbortSignal;
  expect(forwarded.aborted).toBe(false);
  abort.abort();
  expect(forwarded.aborted).toBe(true);
  expect(() => fetchImpl('http://127.0.0.1:11434/api/embed', {})).toThrow();
});
it('preserves the provider timeout signal', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  await checkPrePublish(draftText, '', mountContext(), settings, new AbortController().signal);
  const timeout = new AbortController();
  await vi.mocked(createProvider).mock.calls[0][0].fetchImpl!('http://127.0.0.1:11434/api/embed', { signal: timeout.signal });
  timeout.abort();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});
