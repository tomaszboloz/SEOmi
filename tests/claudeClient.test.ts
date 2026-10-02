import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import {
  CLAUDE_CONNECTION_PROBE_MODEL, CLAUDE_DEFAULT_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_MESSAGES_URL,
  claudeHeaders, claudeMessageText, claudeRequestBody, currentClaudeModel, requestClaudeText,
} from '@/services/ai/claude';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('Claude model identity', () => {
  it('uses current model IDs for the default and the connection probe', () => {
    expect(CLAUDE_DEFAULT_MODEL).toBe('claude-opus-5');
    expect(CLAUDE_CONNECTION_PROBE_MODEL).toBe('claude-haiku-4-5');
  });

  it.each([
    ['claude-3-7-sonnet-20250219', 'claude-sonnet-5'],
    ['claude-3-5-sonnet-20241022', 'claude-sonnet-5'],
    ['claude-3-5-sonnet-20240620', 'claude-sonnet-5'],
    ['claude-3-5-haiku-20241022', 'claude-haiku-4-5'],
  ])('rewrites retired %s to %s', (retired, current) => {
    expect(currentClaudeModel(retired)).toBe(current);
  });

  it('keeps current, unknown and other-provider models unchanged', () => {
    for (const model of ['claude-opus-5', 'claude-sonnet-5', 'gpt-4o', 'gemini-2.0-flash', '', 'custom-model']) {
      expect(currentClaudeModel(model)).toBe(model);
    }
  });
});

describe('Claude request shape', () => {
  it('opts Opus 5 into server-side refusal fallbacks with the matching beta header', () => {
    expect(claudeHeaders('key', 'claude-opus-5')).toEqual({ 'Content-Type': 'application/json', 'x-api-key': 'key', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' });
    expect(claudeRequestBody('claude-opus-5', 'prompt')).toEqual({ model: 'claude-opus-5', max_tokens: CLAUDE_MAX_TOKENS, messages: [{ role: 'user', content: 'prompt' }], fallbacks: 'default' });
  });

  it('sends no fallback parameter or beta header for other models', () => {
    expect(claudeHeaders('key', 'claude-haiku-4-5')['anthropic-beta']).toBeUndefined();
    expect(claudeRequestBody('claude-sonnet-5', 'prompt')).not.toHaveProperty('fallbacks');
  });
});

describe('Claude response text', () => {
  it('skips thinking blocks and joins every text block', () => {
    expect(claudeMessageText({ stop_reason: 'end_turn', content: [{ type: 'thinking', text: '' }, { type: 'text', text: 'A' }, { type: 'tool_use' }, { type: 'text', text: 'B' }] })).toBe('AB');
  });

  it('returns an empty answer for missing or text-less content', () => {
    expect(claudeMessageText({})).toBe('');
    expect(claudeMessageText({ content: [{ type: 'thinking' }, { type: 'text' }] })).toBe('');
  });

  it('turns a policy refusal into a user-facing error instead of empty text', () => {
    expect(() => claudeMessageText({ stop_reason: 'refusal', content: [] })).toThrow(i18n.t('runtimeErrors.ai.refused', { provider: 'Anthropic Claude' }));
  });
});

describe('Claude request transport', () => {
  it('migrates a retired or empty model before sending and returns the answer text', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'answer' }] })));
    expect(await requestClaudeText('key', 'claude-3-5-haiku-20241022', 'p', fetchImpl)).toBe('answer');
    expect(await requestClaudeText('key', '', 'p', fetchImpl)).toBe('answer');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(CLAUDE_MESSAGES_URL);
    expect(JSON.parse(init.body).model).toBe('claude-haiku-4-5');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).model).toBe(CLAUDE_DEFAULT_MODEL);
    expect(fetchImpl.mock.calls[1][1].headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
  });

  it('hands failed HTTP responses back to the caller for provider-specific errors', async () => {
    const failed = new Response('rate limited', { status: 429 });
    const result = await requestClaudeText('key', 'claude-sonnet-5', 'p', vi.fn().mockResolvedValue(failed));
    expect(result).toBe(failed);
  });
});
