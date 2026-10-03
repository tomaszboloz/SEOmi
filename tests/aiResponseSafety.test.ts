import { afterEach, expect, it, vi } from 'vitest';
import { generateAiText } from '@/services/ai/text';
import { callOpenAI, callClaude, callGemini } from '@/services/ai/suggestions';

const providers = ['openai', 'claude', 'gemini'] as const;
const suggestions = { openai: callOpenAI, claude: callClaude, gemini: callGemini };
const envelope = (provider: typeof providers[number], text: unknown) => provider === 'openai'
  ? { choices: [{ message: { content: text } }] }
  : provider === 'claude' ? { content: [{ text }] } : { candidates: [{ content: { parts: [{ text }] } }] };
afterEach(() => vi.restoreAllMocks());

it.each(providers)('%s text error does not expose or consume provider payload', async provider => {
  const response = new Response('secret-key user@example.test private prompt', { status: 503 });
  const text = vi.spyOn(response, 'text');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const failure = await generateAiText(provider, 'secret-key', 'model', 'private prompt').catch(error => error);
  expect(failure).toBeInstanceOf(Error);
  expect(failure.message).toContain('503');
  expect(failure.message).not.toMatch(/secret-key|user@example|private prompt/);
  expect(text).not.toHaveBeenCalled();
});
it.each(providers)('%s suggestion error does not expose or consume provider payload', async provider => {
  const response = new Response('secret-key user@example.test private prompt', { status: 503 });
  const text = vi.spyOn(response, 'text');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const failure = await suggestions[provider]('secret-key', 'model', 'private prompt').catch(error => error);
  expect(failure).toBeInstanceOf(Error);
  expect(failure.message).toContain('503');
  expect(failure.message).not.toMatch(/secret-key|user@example|private prompt/);
  expect(text).not.toHaveBeenCalled();
});
it.each(providers)('%s rejects non-string text instead of leaking a provider object', async provider => {
  for (const value of [42, true, [], { secret: 'private payload' }]) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(envelope(provider, value))));
    await expect(generateAiText(provider, 'key', 'model', 'prompt')).rejects.toThrow();
  }
});
it.each(providers)('%s enforces actual response byte limit with a misleading content length', async provider => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(envelope(provider, 'x'.repeat(1048576))),
    { headers: { 'content-length': '1' } }));
  const result = await generateAiText(provider, 'key', 'model', 'prompt').then(() => 'resolved', () => 'rejected');
  expect(result).toBe('rejected');
});
