import { afterEach, expect, it, vi } from 'vitest';
import {
  discoverOllama,
  getOllamaTags,
  getOllamaVersion,
  MAX_OLLAMA_DISCOVERED_MODELS,
} from '@/services/embeddings/ollamaDiscovery';
import { getOllama, MAX_OLLAMA_RESPONSE_BYTES, ollamaSettings } from '@/services/embeddings/ollamaTransport';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const model = {
  name: 'llama3.2:latest', model: 'llama3.2:latest', modified_at: '2026-10-06T00:00:00Z', size: 12,
  digest: 'sha256:fixture', details: { parent_model: '', format: 'gguf', family: 'llama', families: ['llama'], parameter_size: '3B', quantization_level: 'Q4_K_M' },
};

it('reads and validates the exact version envelope over bounded GET', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(json({ version: '0.12.3' }));
  await expect(getOllamaVersion({ fetchImpl })).resolves.toBe('0.12.3');
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe('http://127.0.0.1:11434/api/version');
  expect(init.method).toBe('GET');
  expect(init.headers).toEqual({ Accept: 'application/json' });
});

it('reads observed model metadata and keeps discovery calls separate', async () => {
  const fetchImpl = vi.fn().mockImplementation(async (url: string) => url.endsWith('/version') ? json({ version: '0.12.3' }) : json({ models: [model] }));
  await expect(getOllamaTags({ fetchImpl })).resolves.toEqual([model]);
  await expect(discoverOllama({ fetchImpl })).resolves.toEqual({ version: '0.12.3', models: [model] });
  expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
    'http://127.0.0.1:11434/api/tags',
    'http://127.0.0.1:11434/api/version',
    'http://127.0.0.1:11434/api/tags',
  ]);
});

it.each([
  ['version', { version: '0.12.3', unexpected: true }],
  ['version', { version: '' }],
  ['tags', { models: [{ ...model, unexpected: true }] }],
  ['tags', { models: [{ ...model, details: { ...model.details, unexpected: true } }] }],
  ['tags', { models: [{ model: 'missing-name' }] }],
])('rejects malformed %s discovery envelope', async (kind, body) => {
  const fetchImpl = vi.fn().mockResolvedValue(json(body));
  const result = kind === 'version' ? getOllamaVersion({ fetchImpl }) : getOllamaTags({ fetchImpl });
  await expect(result).rejects.toThrow(new RegExp(`invalid ${kind}`));
});

it('enforces the discovered model count before returning data', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(json({ models: Array.from({ length: MAX_OLLAMA_DISCOVERED_MODELS + 1 }, () => model) }));
  await expect(getOllamaTags({ fetchImpl })).rejects.toThrow(/invalid tags/);
});

it('hides discovery response bodies on HTTP failures', async () => {
  const secret = 'private server diagnostics';
  const fetchImpl = vi.fn().mockResolvedValue(new Response(secret, { status: 503 }));
  try { await getOllamaVersion({ fetchImpl }); throw new Error('expected rejection'); }
  catch (error) { expect(String(error)).toContain('HTTP 503'); expect(String(error)).not.toContain(secret); }
});

it('bounds streamed discovery responses before schema parsing', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_OLLAMA_RESPONSE_BYTES + 1)); }, cancel });
  const fetchImpl = vi.fn().mockResolvedValue(new Response(body));
  await expect(getOllamaVersion({ fetchImpl })).rejects.toThrow(/too large/);
  expect(cancel).toHaveBeenCalled();
});

it('sanitizes direct GET failures and malformed payloads', async () => {
  const cancel = vi.fn().mockRejectedValue(new Error('private cancellation detail'));
  const failed = { ok: false, status: 503, body: { cancel } } as unknown as Response;
  await expect(getOllama(ollamaSettings({ fetchImpl: vi.fn().mockResolvedValue(failed) }), '/api/version')).rejects.toThrow('HTTP 503');
  await Promise.resolve();
  expect(cancel).toHaveBeenCalled();

  const rejected = vi.fn().mockRejectedValue(new Error('private adapter detail'));
  await expect(getOllama(ollamaSettings({ fetchImpl: rejected }), '/api/version')).rejects.toThrow('Cannot reach Ollama');

  const missingBody = vi.fn().mockResolvedValue({ ok: true, body: null } as unknown as Response);
  await expect(getOllama(ollamaSettings({ fetchImpl: missingBody }), '/api/version')).rejects.toThrow('invalid response');

  const reader = {
    read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    cancel: vi.fn().mockRejectedValue(new Error('private reader cancellation detail')),
    releaseLock: vi.fn(),
  };
  const malformed = vi.fn().mockResolvedValue({ ok: true, body: { getReader: () => reader } } as unknown as Response);
  await expect(getOllama(ollamaSettings({ fetchImpl: malformed }), '/api/version')).rejects.toThrow('invalid response');
  expect(reader.cancel).toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalled();

  const array = vi.fn().mockResolvedValue(json([]));
  await expect(getOllama(ollamaSettings({ fetchImpl: array }), '/api/version')).rejects.toThrow('invalid response');
});

it('times out a pending GET and disposes a late response body', async () => {
  vi.useFakeTimers();
  let resolve!: (response: Response) => void;
  const cancel = vi.fn().mockRejectedValue(new Error('private late cancellation detail'));
  const fetchImpl = vi.fn(() => new Promise<Response>((yes) => { resolve = yes; }));
  const pending = getOllama(ollamaSettings({ fetchImpl, timeoutMs: 1 }), '/api/version');
  const assertion = expect(pending).rejects.toThrow('Cannot reach Ollama');
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  resolve({ ok: true, body: { cancel } } as unknown as Response);
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalled();
});

it('times out a stalled GET body after headers arrive', async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const fetchImpl = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ cancel })));
  const pending = getOllama(ollamaSettings({ fetchImpl, timeoutMs: 1 }), '/api/version');
  const assertion = expect(pending).rejects.toThrow('Ollama request timed out');
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(cancel).toHaveBeenCalled();
});
