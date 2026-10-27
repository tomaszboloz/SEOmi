import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeTauriCommand } from '@/services/tauri';
import { testAiConnection } from '@/services/ai/connection';
import { nativeSuggestions, nativeText } from '@/services/ai/native';
import { aiResponseError, readAiResponseText } from '@/services/ai/response';
import { extractJsonObject, parseAiSuggestionResponse } from '@/services/ai/parsing';
import { claudeHeaders, claudeMessageText } from '@/services/ai/claude';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
const invoke = vi.mocked(invokeTauriCommand);
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const suggestion = { suggestedTitle: 'Title', suggestedDescription: 'Description', keyImprovements: ['one'] };

beforeEach(() => {
  invoke.mockReset();
  vi.stubGlobal('fetch', vi.fn());
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('AI transport and bounded response handling', () => {
  it('maps browser provider statuses and network failures to localized errors', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({}, 429)).mockResolvedValueOnce(response({}, 503));
    await expect(testAiConnection('openai', 'key')).resolves.toMatchObject({ success: false });
    await expect(testAiConnection('openai', 'key')).resolves.toMatchObject({ success: false });
    await expect(testAiConnection('claude', 'key')).resolves.toMatchObject({ success: false });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(testAiConnection('gemini', 'key')).resolves.toMatchObject({ success: false, message: expect.stringContaining('offline') });
    await expect(testAiConnection('openai', '   ')).resolves.toMatchObject({ success: false });
  });

  it('handles desktop connection probes and status categories', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValueOnce({ success: true, status: null })
      .mockResolvedValueOnce({ success: false, status: 401 })
      .mockResolvedValueOnce({ success: false, status: 429 })
      .mockResolvedValueOnce({ success: false, status: 500 });
    await expect(testAiConnection('openai', '')).resolves.toMatchObject({ success: true });
    await expect(testAiConnection('openai', 'key')).resolves.toMatchObject({ success: false });
    await expect(testAiConnection('openai', 'key')).resolves.toMatchObject({ success: false });
    await expect(testAiConnection('openai', 'key')).resolves.toMatchObject({ success: false });
  });

  it('translates native provider failures and rejects provider error envelopes', async () => {
    invoke.mockRejectedValueOnce(new Error('HTTP 429')).mockRejectedValueOnce(new Error('credential is not configured'));
    await expect(nativeSuggestions('openai', 'gpt-4o', 'prompt')).rejects.toThrow();
    await expect(nativeText('claude', 'claude-opus-5', 'prompt')).rejects.toThrow();
    invoke.mockResolvedValueOnce(JSON.stringify({ choices: [{ message: { content: 'answer' } }] }));
    await expect(nativeText('openai', 'gpt-4o', 'prompt')).resolves.toBe('answer');
    invoke.mockResolvedValueOnce(JSON.stringify({ error: 'private provider body' }));
    await expect(nativeText('openai', 'gpt-4o', 'prompt')).rejects.toThrow();
  });

  it('reads each provider envelope and protects malformed or oversized streams', async () => {
    await expect(readAiResponseText(response({ choices: [{ message: { content: 'openai' } }] }), 'openai')).resolves.toBe('openai');
    await expect(readAiResponseText(response({ content: [{ type: 'text', text: 'claude' }] }), 'claude')).resolves.toBe('claude');
    await expect(readAiResponseText(response({ candidates: [{ content: { parts: [{ text: 'gemini' }] } }] }), 'gemini')).resolves.toBe('gemini');
    await expect(readAiResponseText(new Response('invalid'), 'openai')).rejects.toThrow();
    await expect(readAiResponseText(new Response(null), 'openai')).rejects.toThrow();
    expect(aiResponseError('gemini', 403, true)).toBeInstanceOf(Error);
    expect(aiResponseError('openai', 404, false, 'missing-model').message).toContain('missing-model');
  });

  it('parses fenced and explanatory JSON while enforcing suggestion fields', () => {
    expect(parseAiSuggestionResponse(`Explanation\n\`\`\`json\n${JSON.stringify(suggestion)}\n\`\`\``)).toMatchObject(suggestion);
    expect(extractJsonObject('prefix {"text":"brace } inside"} suffix')).toContain('brace } inside');
    expect(() => parseAiSuggestionResponse(JSON.stringify({ suggestedTitle: 'x' }))).toThrow();
    expect(() => extractJsonObject('no JSON here')).toThrow();
    expect(claudeHeaders('key', 'claude-opus-5')).toHaveProperty('anthropic-beta');
    expect(() => claudeMessageText({ stop_reason: 'refusal' })).toThrow();
  });
});
