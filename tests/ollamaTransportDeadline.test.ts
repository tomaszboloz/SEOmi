import { afterEach, expect, it, vi } from 'vitest';
import { createOllamaGenerator } from '@/services/embeddings/ollama';
import { MAX_OLLAMA_RESPONSE_BYTES, MAX_OLLAMA_TIMEOUT_MS, MAX_OLLAMA_BATCH_SIZE, boundedOllamaInteger, ollamaSettings, postOllama } from '@/services/embeddings/ollamaTransport';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('enforces the deadline while an adapter ignores its signal and cancels a late body', async () => {
  vi.useFakeTimers();
  let resolve!: (value: Response) => void;
  const fetchImpl = vi.fn((_input: string, _init: RequestInit) => new Promise<Response>((yes) => { resolve = yes; }));
  const cancel = vi.fn();
  const pending = createOllamaGenerator({ fetchImpl, timeoutMs: 1 })('prompt');
  const assertion = expect(pending).rejects.toThrow(/Cannot reach Ollama/);
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  const signal = fetchImpl.mock.calls[0][1]?.signal;
  expect(signal?.aborted).toBe(true);
  resolve(new Response(new ReadableStream({ cancel })));
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalled();
});

it('times out and cancels a stalled response body after headers arrive', async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const fetchImpl = vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel })));
  const pending = createOllamaGenerator({ fetchImpl, timeoutMs: 1 })('prompt');
  const assertion = expect(pending).rejects.toThrow('Ollama request timed out');
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(cancel).toHaveBeenCalled();
});

it('accepts the exact byte bound and validates multibyte UTF-8', async () => {
  const text = JSON.stringify({ response: 'żółw' });
  const bytes = new TextEncoder().encode(text);
  const buffer = new Uint8Array(MAX_OLLAMA_RESPONSE_BYTES).fill(32);
  buffer.set(bytes);
  const fetchImpl = vi.fn().mockResolvedValue(new Response(buffer));
  expect(await createOllamaGenerator({ fetchImpl })('prompt')).toBe('żółw');
  const invalid = vi.fn().mockResolvedValue(new Response(new Uint8Array([0xff])));
  await expect(createOllamaGenerator({ fetchImpl: invalid })('prompt')).rejects.toThrow('Ollama returned an invalid response');
});

it('rejects missing bodies and hides synchronous adapter exceptions', async () => {
  await expect(createOllamaGenerator({ fetchImpl: vi.fn().mockResolvedValue(new Response(null)) })('prompt')).rejects.toThrow('Ollama returned an invalid response');
  const fetchImpl = vi.fn(() => { throw new Error('private adapter path'); });
  await expect(createOllamaGenerator({ fetchImpl })('prompt')).rejects.toThrow(/^Cannot reach Ollama at/);
});

it('validates both boundaries directly and retains resolved defaults', () => {
  for (const maximum of [MAX_OLLAMA_TIMEOUT_MS, MAX_OLLAMA_BATCH_SIZE]) {
    expect(boundedOllamaInteger(1, maximum, 'fixture')).toBe(1);
    expect(boundedOllamaInteger(maximum, maximum, 'fixture')).toBe(maximum);
    expect(() => boundedOllamaInteger(maximum + 1, maximum, 'fixture')).toThrow('fixture');
  }
  expect(ollamaSettings({})).toMatchObject({ baseUrl: 'http://127.0.0.1:11434', timeoutMs: 60000 });
});

it('uses the default fetch adapter, exact JSON and an unexpired signal', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response('{"response":"ok"}'));
  vi.stubGlobal('fetch', fetchImpl);
  expect(await postOllama(ollamaSettings({}), '/api/generate', { prompt: 'p' })).toEqual({ response: 'ok' });
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe('http://127.0.0.1:11434/api/generate');
  expect(init.method).toBe('POST');
  expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(init.body).toBe('{"prompt":"p"}');
  expect(init.signal.aborted).toBe(false);
});
