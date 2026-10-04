import { afterEach, expect, it, vi } from 'vitest';
import { aiResponseError, MAX_AI_RESPONSE_BYTES, readAiResponseText } from '@/services/ai/response';
import i18n from '@/i18n';

const invalid = () => i18n.t('runtimeErrors.ai.invalidResponse');
const envelope = (text: unknown) => JSON.stringify({ choices: [{ message: { content: text } }] });
afterEach(() => vi.restoreAllMocks());

it('reads split multibyte UTF-8 chunks and preserves exact provider text', async () => {
  const bytes = new TextEncoder().encode(envelope('żółć 日本語'));
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  expect(await readAiResponseText(new Response(stream), 'openai')).toBe('żółć 日本語');
});
it('accepts the exact byte cap and stops consumption at the first oversized chunk', async () => {
  const overhead = new TextEncoder().encode(envelope('')).length;
  const exact = 'x'.repeat(MAX_AI_RESPONSE_BYTES - overhead);
  expect(await readAiResponseText(new Response(envelope(exact)), 'openai')).toBe(exact);
  const cancel = vi.fn();
  let reads = 0;
  const stream = new ReadableStream({ pull(controller) {
    reads++;
    controller.enqueue(new Uint8Array(MAX_AI_RESPONSE_BYTES + 1));
  }, cancel }, { highWaterMark: 0 });
  await expect(readAiResponseText(new Response(stream, { headers: { 'content-length': '1' } }), 'openai'))
    .rejects.toThrow(i18n.t('runtimeErrors.ai.responseTooLarge'));
  expect(reads).toBe(1);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});
it('suppresses cancellation errors and releases the reader after malformed JSON', async () => {
  const cancel = vi.fn().mockRejectedValue(new Error('private cancellation detail'));
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{private')); controller.close(); }, cancel });
  await expect(readAiResponseText(new Response(stream), 'openai')).rejects.toThrow(invalid());
  expect(stream.locked).toBe(false);
});
it('sanitizes stream failures and malformed UTF-8 instead of returning partial text', async () => {
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('private stream payload')); } });
  await expect(readAiResponseText(new Response(stream), 'openai')).rejects.toThrow(invalid());
  expect(stream.locked).toBe(false);
  await expect(readAiResponseText(new Response(Uint8Array.of(0xff)), 'openai')).rejects.toThrow(invalid());
});
it.each([null, [], 42, 'text', true, { choices: true }, { choices: [null] }, { choices: [{ message: [] }] }])('rejects invalid envelope %j without exposing its bytes', async value => {
    await expect(readAiResponseText(new Response(JSON.stringify(value)), 'openai')).rejects.toThrow(invalid());
  });
it('rejects missing body and preserves empty or null model text as empty evidence', async () => {
  await expect(readAiResponseText(new Response(null), 'openai')).rejects.toThrow(invalid());
  for (const provider of ['openai', 'claude', 'gemini'] as const) {
    expect(await readAiResponseText(new Response('{}'), provider)).toBe('');
  }
  for (const value of [null, '', undefined]) {
    expect(await readAiResponseText(new Response(envelope(value)), 'openai')).toBe('');
  }
  expect(await readAiResponseText(new Response('{"content":[]}'), 'claude')).toBe('');
  expect(await readAiResponseText(new Response('{"candidates":[{"content":{"parts":[]}}]}'), 'gemini')).toBe('');
});
it('directly preserves auth/quota/status diagnostics without a provider body', () => {
  for (const provider of ['openai', 'claude', 'gemini'] as const) {
    const name = i18n.t(`legacyUi.ai.${provider}`);
    expect(aiResponseError(provider, 401, true).message).toBe(i18n.t('runtimeErrors.ai.authFailed', { provider: name }));
    const host = { openai: 'platform.openai.com', claude: 'console.anthropic.com', gemini: 'aistudio.google.com' }[provider];
    expect(aiResponseError(provider, 429, true).message).toBe(i18n.t('runtimeErrors.ai.quota', { provider: name, host }));
    expect(aiResponseError(provider, 503).message).toBe(i18n.t('runtimeErrors.ai.apiError', { provider: name, status: 503, detail: i18n.t('runtimeErrors.ai.responseHidden') }));
    expect(aiResponseError(provider, 403, true).message).toBe(provider === 'gemini'
      ? i18n.t('runtimeErrors.ai.authFailed', { provider: name })
      : i18n.t('runtimeErrors.ai.apiError', { provider: name, status: 403, detail: i18n.t('runtimeErrors.ai.responseHidden') }));
  }
});
