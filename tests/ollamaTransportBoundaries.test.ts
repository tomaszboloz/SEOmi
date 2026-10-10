import { expect, it, vi } from 'vitest';
import { createOllamaEmbeddingProvider, createOllamaGenerator, ollamaBaseUrl } from '@/services/embeddings/ollama';

const json = (value: unknown) => new Response(JSON.stringify(value));

it.each([NaN, Infinity, -1, 0, 1.5, 300001])('rejects invalid timeout %s before dispatch', (timeoutMs) => {
  const fetchImpl = vi.fn();
  expect(() => createOllamaGenerator({ timeoutMs, fetchImpl })).toThrow(/timeout/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it.each([NaN, Infinity, -1, 0, 1.5, 129])('rejects invalid batch size %s', (batchSize) => {
  expect(() => createOllamaEmbeddingProvider({ batchSize })).toThrow(/batch/);
});

it.each(['http://host/api', 'http://host?key=secret', 'http://host#fragment'])('rejects a non-origin Ollama endpoint', (url) => {
  expect(() => ollamaBaseUrl(url)).toThrow(/origin/);
});

it('bounds streamed responses regardless of a false Content-Length', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));
  }, cancel });
  const fetchImpl = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Length': '1' } }));
  await expect(createOllamaGenerator({ fetchImpl })('p')).rejects.toThrow(/too large/);
  expect(cancel).toHaveBeenCalled();
});

it('does not expose HTTP error response bodies', async () => {
  const secret = 'private model path and prompt';
  const fetchImpl = vi.fn().mockResolvedValue(new Response(secret, { status: 500 }));
  try { await createOllamaGenerator({ fetchImpl })('p'); throw new Error('expected rejection'); }
  catch (error) {
    expect(String(error)).toContain('HTTP 500');
    expect(String(error)).not.toContain(secret);
  }
});

it('sanitizes invalid JSON and interrupted body errors', async () => {
  for (const response of [new Response('private invalid JSON'), new Response(new ReadableStream({ start(controller) { controller.error(new Error('private transport text')); } }))]) {
    const fetchImpl = vi.fn().mockResolvedValue(response);
    await expect(createOllamaGenerator({ fetchImpl })('p')).rejects.toThrow(/^Ollama returned an invalid response$/);
  }
});

it('validates a JSON object before accessing response fields', async () => {
  for (const value of [null, [], 42]) {
    const fetchImpl = vi.fn().mockResolvedValue(json(value));
    await expect(createOllamaGenerator({ fetchImpl })('p')).rejects.toThrow(/^Ollama returned an invalid response$/);
  }
});
