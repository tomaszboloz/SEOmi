import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import {
  CLAUDE_CONNECTION_PROBE_MODEL, CLAUDE_DEFAULT_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_MESSAGES_URL,
  claudeHeaders, claudeMessageText, claudeRequestBody, requestClaude,
} from '@/services/ai/claude';
import { GEMINI_DEFAULT_MODEL, currentModel } from '@/services/ai/modelCatalog';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('hosted model identity', () => {
  it('uses current model IDs for the default and the connection probe', () => {
    expect(CLAUDE_DEFAULT_MODEL).toBe('claude-opus-5');
    expect(CLAUDE_CONNECTION_PROBE_MODEL).toBe('claude-haiku-4-5');
    expect(GEMINI_DEFAULT_MODEL).toBe('gemini-3.8-flash');
  });

  it.each([
    ['claude-3-7-sonnet-20250219', 'claude-sonnet-5'],
    ['claude-3-5-sonnet-20241022', 'claude-sonnet-5'],
    ['claude-3-5-sonnet-20240620', 'claude-sonnet-5'],
    ['claude-3-5-haiku-20241022', 'claude-haiku-4-5'],
    ['gemini-2.0-flash', 'gemini-3.8-flash'],
    ['gemini-2.0-pro-exp-02-05', 'gemini-3.1-pro-preview'],
    ['gemini-1.5-pro', 'gemini-3.1-pro-preview'],
  ])('rewrites retired %s to %s', (retired, current) => {
    expect(currentModel(retired)).toBe(current);
  });

  it('keeps current, unknown and other-provider models unchanged', () => {
    for (const model of ['claude-opus-5', 'claude-sonnet-5', 'gpt-4o', 'gpt-4o-mini', GEMINI_DEFAULT_MODEL, '', 'custom-model']) {
      expect(currentModel(model)).toBe(model);
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
  const ok = () => new Response('{}');
  it('migrates a retired or empty model before sending', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => ok());
    await requestClaude('key', 'claude-3-5-haiku-20241022', 'p', fetchImpl);
    await requestClaude('key', '', 'p', fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(CLAUDE_MESSAGES_URL);
    expect(JSON.parse(init.body).model).toBe('claude-haiku-4-5');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).model).toBe(CLAUDE_DEFAULT_MODEL);
    expect(fetchImpl.mock.calls[1][1].headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
  });

  it('hands the raw response back so the caller maps provider errors', async () => {
    const failed = new Response('rate limited', { status: 429 });
    expect(await requestClaude('key', 'claude-sonnet-5', 'p', vi.fn().mockResolvedValue(failed))).toBe(failed);
  });
});
