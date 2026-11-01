import { createOllamaChat, type OllamaChatMessage } from '@/services/embeddings/ollamaChat';

export type EntityChat = (messages: OllamaChatMessage[]) => Promise<{ text: string }>;

const MAX_TEXTS = 200;
const MAX_PROMPT_CHARS = 12_000;
const MAX_ENTITIES = 200;
/** Local server only; the same address the Ollama assistant uses. */
export const ENTITY_OLLAMA_URL = 'http://127.0.0.1:11434';

/** First JSON string array in a model answer; anything else yields []. */
export const parseEntityList = (answer: string): string[] => {
  const match = /\[[\s\S]*\]/.exec(answer);
  if (!match) return [];
  try {
    // The match starts with "[" and ends with "]", so any valid JSON here is an array.
    const parsed = JSON.parse(match[0]) as unknown[];
    const names = parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item.length >= 3 && item.length <= 80);
    return [...new Set(names)].slice(0, MAX_ENTITIES);
  } catch { return []; }
};

const promptFor = (texts: string[]): string => {
  const lines = [...new Set(texts.map((text) => text.trim()).filter(Boolean))].slice(0, MAX_TEXTS).join('\n').slice(0, MAX_PROMPT_CHARS);
  return `List the named entities (brands, products, people, places, standards, technical terms) that appear in these page headings. Answer with a JSON array of strings only, copied exactly as written.\n\n${lines}`;
};

/** Optional model-backed recogniser. Never throws: a missing or failing model simply adds no names, the heuristic still runs. */
export const extractEntitiesWithChat = async (texts: string[], chat: EntityChat): Promise<string[]> => {
  try { return parseEntityList((await chat([{ role: 'user', content: promptFor(texts) }])).text); } catch { return []; }
};

export const createOllamaEntityChat = (model: string): EntityChat => createOllamaChat({ baseUrl: ENTITY_OLLAMA_URL, model, maxOutputTokens: 1024 });
