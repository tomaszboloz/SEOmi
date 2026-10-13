/**
 * Hosted model IDs that providers have shut down, mapped to supported successors.
 * Earlier versions saved these IDs in global and per-project preferences.
 */
const RETIRED_MODELS: Record<string, string> = {
  'claude-3-7-sonnet-20250219': 'claude-sonnet-5',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'claude-3-5-sonnet-20240620': 'claude-sonnet-5',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5',
  'gemini-2.0-flash': 'gemini-3.8-flash',
  'gemini-2.0-pro-exp-02-05': 'gemini-3.1-pro-preview',
  'gemini-1.5-pro': 'gemini-3.1-pro-preview',
  // o3-mini shuts down on 2026-10-23; it is no longer offered.
  'o3-mini': 'gpt-4o-mini',
  'o3-mini-2025-01-31': 'gpt-4o-mini',
  // Still listed by OpenAI on 2026-10-13, but every request answers model_not_found (deprecated).
  'gpt-5-chat-latest': 'gpt-5.4',
  'gpt-5.1-chat-latest': 'gpt-5.4',
  'gpt-5.2-chat-latest': 'gpt-5.4',
  'gpt-5.3-chat-latest': 'gpt-5.4',
  'gpt-3.5-turbo-1106': 'gpt-3.5-turbo',
};

export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

export const currentModel = (model: string): string => RETIRED_MODELS[model] ?? model;

/** Retired or shutting-down models are never offered, even if a provider still lists them. */
export const isHiddenModel = (model: string): boolean => model in RETIRED_MODELS;
