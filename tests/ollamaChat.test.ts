import { afterEach, expect, it, vi } from 'vitest';
import {
  createOllamaChat,
  DEFAULT_OLLAMA_CHAT_OUTPUT_TOKENS,
  MAX_OLLAMA_CHAT_MESSAGES,
  MAX_OLLAMA_CHAT_MESSAGE_CHARS,
  MAX_OLLAMA_CHAT_OUTPUT_TOKENS,
} from '@/services/embeddings/ollamaChat';

afterEach(() => vi.restoreAllMocks());
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const answer = (extra: Record<string, unknown> = {}) => ({
  model: 'llama3.2', message: { role: 'assistant', content: 'Observed answer' }, done: true, ...extra,
});

it('sends an exact bounded chat envelope and preserves observed usage only', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(json(answer({ prompt_eval_count: 3, eval_count: 5 })));
  const chat = createOllamaChat({ model: 'llama3.2', maxOutputTokens: 123, fetchImpl });
  await expect(chat([{ role: 'user', content: 'literal prompt' }])).resolves.toEqual({
    model: 'llama3.2', text: 'Observed answer',
    usage: { promptTokens: 3, completionTokens: 5, totalTokens: null },
  });
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe('http://127.0.0.1:11434/api/chat');
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({
    model: 'llama3.2', messages: [{ role: 'user', content: 'literal prompt' }], stream: false,
    options: { temperature: 0, num_predict: 123 },
  });
});

it('uses a bounded default output token request', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(json(answer()));
  await createOllamaChat({ model: 'm', fetchImpl })([{ role: 'user', content: 'p' }]);
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body)).options.num_predict).toBe(DEFAULT_OLLAMA_CHAT_OUTPUT_TOKENS);
});

it.each([0, 1.5, MAX_OLLAMA_CHAT_OUTPUT_TOKENS + 1])('rejects invalid output token bound %s before dispatch', (maxOutputTokens) => {
  const fetchImpl = vi.fn();
  expect(() => createOllamaChat({ model: 'm', maxOutputTokens, fetchImpl })).toThrow(/output tokens/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('rejects a missing or blank model before dispatch', () => {
  const fetchImpl = vi.fn();
  expect(() => createOllamaChat({ fetchImpl })).toThrow(/Invalid Ollama chat model/);
  expect(() => createOllamaChat({ model: '   ', fetchImpl })).toThrow(/Invalid Ollama chat model/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('rejects invalid, oversized and overlong messages before dispatch', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(json(answer()));
  const chat = createOllamaChat({ model: 'm', fetchImpl });
  await expect(chat([])).rejects.toThrow(/messages/);
  await expect(chat([{ role: 'tool' as 'user', content: 'x' }])).rejects.toThrow(/messages/);
  await expect(chat([{ role: 'user', content: 'x'.repeat(MAX_OLLAMA_CHAT_MESSAGE_CHARS + 1) }])).rejects.toThrow(/messages/);
  const oversized = Array.from({ length: MAX_OLLAMA_CHAT_MESSAGES }, () => ({ role: 'user' as const, content: 'x'.repeat(MAX_OLLAMA_CHAT_MESSAGE_CHARS) }));
  await expect(chat(oversized)).rejects.toThrow(/request too large/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it.each([
  answer({ done: false }),
  answer({ message: { role: 'user', content: 'wrong role' } }),
  { ...answer(), unexpected: 'field' },
])('rejects an unvalidated chat envelope %#', async (body) => {
  const chat = createOllamaChat({ model: 'm', fetchImpl: vi.fn().mockResolvedValue(json(body)) });
  await expect(chat([{ role: 'user', content: 'p' }])).rejects.toThrow(/invalid chat response/);
});

it('keeps absent usage unknown and never exposes an HTTP body', async () => {
  const secret = 'private prompt and model path';
  const fetchImpl = vi.fn().mockResolvedValue(new Response(secret, { status: 500 }));
  const chat = createOllamaChat({ model: 'm', fetchImpl });
  try { await chat([{ role: 'user', content: 'p' }]); throw new Error('expected rejection'); }
  catch (error) { expect(String(error)).toContain('HTTP 500'); expect(String(error)).not.toContain(secret); }
  const noUsage = createOllamaChat({ model: 'm', fetchImpl: vi.fn().mockResolvedValue(json(answer())) });
  await expect(noUsage([{ role: 'user', content: 'p' }])).resolves.toMatchObject({ usage: { promptTokens: null, completionTokens: null, totalTokens: null } });
});
