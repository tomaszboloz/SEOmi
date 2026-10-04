import { z } from 'zod';
import type { AiProvider } from '@/types';
import { CLAUDE_DEFAULT_MODEL } from './claude';
import { GEMINI_DEFAULT_MODEL, isHiddenModel } from './modelCatalog';

export interface AiModelOption {
  id: string;
  label: string;
}

export type ModelListFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Shown until a connected API key returns the provider's own model list. */
export const FALLBACK_MODELS: Record<AiProvider, AiModelOption[]> = {
  openai: [{ id: 'gpt-4o', label: 'GPT-4o' }, { id: 'gpt-4o-mini', label: 'GPT-4o mini' }],
  claude: [{ id: CLAUDE_DEFAULT_MODEL, label: 'Claude Opus 5' }, { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' }, { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }],
  gemini: [{ id: GEMINI_DEFAULT_MODEL, label: 'Gemini 3.8 Flash' }, { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' }, { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' }],
};

const MAX_MODELS = 300;
const MAX_PAGES = 5;

// Models listed by OpenAI include embeddings, audio, image and moderation
// models that cannot answer a chat request; only text generation is offered.
const OPENAI_NON_CHAT = /(embedding|whisper|tts|dall-e|image|audio|realtime|transcribe|moderation|search|davinci|babbage|computer-use)/i;
const isOpenAiChatModel = (id: string): boolean => /^(gpt-|o\d|chatgpt-)/i.test(id) && !OPENAI_NON_CHAT.test(id);

const OpenAiList = z.object({ data: z.array(z.object({ id: z.string().min(1), created: z.number().optional() })) });
const ClaudeList = z.object({
  data: z.array(z.object({ id: z.string().min(1), display_name: z.string().optional() })),
  has_more: z.boolean().optional(),
  last_id: z.string().nullable().optional(),
});
const GeminiList = z.object({
  models: z.array(z.object({
    name: z.string().min(1),
    displayName: z.string().optional(),
    supportedGenerationMethods: z.array(z.string()).optional(),
  })).optional().default([]),
  nextPageToken: z.string().optional(),
});

export class ModelListError extends Error {
  constructor(readonly status: number) {
    super(`Model list request failed with HTTP ${status}`);
  }
}

const readJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) throw new ModelListError(response.status);
  return response.json();
};

const listOpenAi = async (apiKey: string, fetchImpl: ModelListFetch): Promise<AiModelOption[]> => {
  const body = OpenAiList.parse(await readJson(await fetchImpl('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } })));
  return body.data
    .filter((model) => isOpenAiChatModel(model.id))
    .sort((left, right) => (right.created ?? 0) - (left.created ?? 0) || left.id.localeCompare(right.id))
    .map((model) => ({ id: model.id, label: model.id }));
};

const listClaude = async (apiKey: string, fetchImpl: ModelListFetch): Promise<AiModelOption[]> => {
  const models: AiModelOption[] = [];
  let after: string | null | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: '100', ...(after ? { after_id: after } : {}) });
    const body = ClaudeList.parse(await readJson(await fetchImpl(`https://api.anthropic.com/v1/models?${query}`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    })));
    models.push(...body.data.map((model) => ({ id: model.id, label: model.display_name || model.id })));
    if (!body.has_more || !body.last_id) break;
    after = body.last_id;
  }
  return models;
};

const listGemini = async (apiKey: string, fetchImpl: ModelListFetch): Promise<AiModelOption[]> => {
  const models: AiModelOption[] = [];
  let pageToken = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ key: apiKey, pageSize: '1000', ...(pageToken ? { pageToken } : {}) });
    const body = GeminiList.parse(await readJson(await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models?${query}`)));
    for (const model of body.models) {
      const id = model.name.replace(/^models\//, '');
      if (!id.startsWith('gemini') || /embedding/i.test(id)) continue;
      if (!(model.supportedGenerationMethods ?? []).includes('generateContent')) continue;
      models.push({ id, label: model.displayName || id });
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return models;
};

const listers: Record<AiProvider, (apiKey: string, fetchImpl: ModelListFetch) => Promise<AiModelOption[]>> = {
  openai: listOpenAi,
  claude: listClaude,
  gemini: listGemini,
};

/** Text-generation models the API key can use, newest first where the provider reports dates. */
export const listProviderModels = async (provider: AiProvider, apiKey: string, fetchImpl: ModelListFetch = fetch): Promise<AiModelOption[]> => {
  if (!apiKey.trim()) return [];
  const seen = new Set<string>();
  return (await listers[provider](apiKey.trim(), fetchImpl))
    .filter((model) => !isHiddenModel(model.id) && !seen.has(model.id) && seen.add(model.id))
    .slice(0, MAX_MODELS);
};

/** Options for a select: the fetched list (or fallback), always including the current choice. */
export const modelOptionsFor = (provider: AiProvider, fetched: AiModelOption[] | undefined, current: string): AiModelOption[] => {
  const options = fetched?.length ? fetched : FALLBACK_MODELS[provider];
  return !current || options.some((option) => option.id === current) ? options : [{ id: current, label: current }, ...options];
};
