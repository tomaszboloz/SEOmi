import i18n from '@/i18n';
import { aiProviderLabel } from './labels';

export const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const CLAUDE_DEFAULT_MODEL = 'claude-opus-5';
/** Cheapest current model; only used to prove that an API key is accepted. */
export const CLAUDE_CONNECTION_PROBE_MODEL = 'claude-haiku-4-5';
// Thinking is on by default for current models and is counted in max_tokens.
export const CLAUDE_MAX_TOKENS = 16_000;
const SERVER_SIDE_FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MODELS_WITH_SERVER_FALLBACK = new Set(['claude-opus-5', 'claude-fable-5']);

/** Retired model IDs saved by earlier versions, mapped to their supported successors. */
const RETIRED_CLAUDE_MODELS: Record<string, string> = {
  'claude-3-7-sonnet-20250219': 'claude-sonnet-5',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'claude-3-5-sonnet-20240620': 'claude-sonnet-5',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
};

export const currentClaudeModel = (model: string): string => RETIRED_CLAUDE_MODELS[model] ?? model;

export const claudeHeaders = (apiKey: string, model: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  ...(MODELS_WITH_SERVER_FALLBACK.has(model) ? { 'anthropic-beta': SERVER_SIDE_FALLBACK_BETA } : {}),
});

export const claudeRequestBody = (model: string, prompt: string): Record<string, unknown> => ({
  model,
  max_tokens: CLAUDE_MAX_TOKENS,
  messages: [{ role: 'user', content: prompt }],
  // A policy decline is re-run server-side on Anthropic's recommended model.
  ...(MODELS_WITH_SERVER_FALLBACK.has(model) ? { fallbacks: 'default' } : {}),
});

interface ClaudeMessage {
  stop_reason?: string | null;
  content?: Array<{ type?: string; text?: string }>;
}

/**
 * Extracts the answer text. Thinking blocks precede the text block on current
 * models, so the first content block is not necessarily the answer.
 */
export const claudeMessageText = (message: ClaudeMessage): string => {
  if (message.stop_reason === 'refusal') {
    throw new Error(i18n.t('runtimeErrors.ai.refused', { provider: aiProviderLabel('claude') }));
  }
  return (message.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
};

export type ClaudeFetch = (input: string, init: RequestInit) => Promise<Response>;

/** Single Messages API call shared by AI suggestions and free-form AI text. */
export const requestClaudeText = async (apiKey: string, model: string, prompt: string, fetchImpl: ClaudeFetch = fetch): Promise<Response | string> => {
  const resolvedModel = currentClaudeModel(model || CLAUDE_DEFAULT_MODEL);
  const response = await fetchImpl(CLAUDE_MESSAGES_URL, {
    method: 'POST',
    headers: claudeHeaders(apiKey, resolvedModel),
    body: JSON.stringify(claudeRequestBody(resolvedModel, prompt)),
  });
  if (!response.ok) return response;
  return claudeMessageText(await response.json() as ClaudeMessage);
};
