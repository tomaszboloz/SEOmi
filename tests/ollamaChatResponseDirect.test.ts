import { expect, it } from 'vitest';
import { MAX_OLLAMA_CHAT_RESPONSE_CHARS, parseOllamaChatResponse } from '@/services/embeddings/ollamaChat';

const response = (patch: Record<string, unknown> = {}) => ({
  model: 'observed-model', message: { role: 'assistant', content: 'Observed text' }, done: true, ...patch,
});

it('preserves literal model/text and observed usage without inventing totals', () => {
  expect(parseOllamaChatResponse(response({ prompt_eval_count: 0, eval_count: 7 }))).toEqual({
    model: 'observed-model', text: 'Observed text', usage: { promptTokens: 0, completionTokens: 7, totalTokens: null },
  });
  expect(parseOllamaChatResponse(response()).usage).toEqual({ promptTokens: null, completionTokens: null, totalTokens: null });
  expect(parseOllamaChatResponse(response({ message: { role: 'assistant', content: '' } })).text).toBe('');
});

it.each([
  null, [], response({ model: ' ' }), response({ done: false }), response({ prompt_eval_count: -1 }),
  response({ eval_count: 1.5 }), response({ unexpected: 'private-data' }),
  response({ message: { role: 'user', content: 'Wrong role' } }),
  response({ message: { role: 'assistant', content: 'x'.repeat(MAX_OLLAMA_CHAT_RESPONSE_CHARS + 1) } }),
])('rejects invalid complete chat payloads with a private generic error %#', payload => {
  expect(() => parseOllamaChatResponse(payload)).toThrow('Ollama returned an invalid chat response');
});

it('accepts the documented response text bound exactly', () => {
  const content = 'x'.repeat(MAX_OLLAMA_CHAT_RESPONSE_CHARS);
  expect(parseOllamaChatResponse(response({ message: { role: 'assistant', content } })).text).toBe(content);
});
