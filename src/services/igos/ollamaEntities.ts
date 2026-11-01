import { spanKey } from './entities';

/** Limitation code: entities were extended by the local Ollama model (heuristic spans still included). */
export const OLLAMA_ENTITIES = 'ollama-entities';
/** Limitation code: the Ollama entity call failed, so the heuristic alone was used. */
export const OLLAMA_ENTITIES_UNAVAILABLE = 'ollama-entities-unavailable';

export const OLLAMA_ENTITY_PROFILE = { maxChars: 6000, maxEntities: 40 } as const;
export type EntityExtractor = (text: string) => Promise<string[]>;

const PROMPT = 'List the named entities (people, organisations, products, places, concepts) of the text below as a JSON array of strings, nothing else.\n\n';

/** Parses the first JSON array in a model reply; throws when there is none so the caller can fall back. */
export const parseEntityReply = (reply: string): string[] => {
  const match = /\[[\s\S]*\]/u.exec(reply);
  const parsed: unknown = match ? JSON.parse(match[0]) : null;
  if (!Array.isArray(parsed)) throw new Error('Ollama returned no entity list');
  const keys = parsed.map((value) => (typeof value === 'string' ? spanKey(value) : null)).filter((key): key is string => key !== null);
  return [...new Set(keys)].slice(0, OLLAMA_ENTITY_PROFILE.maxEntities);
};

/** Optional Ollama-backed extractor (project setting: label model). Same normalisation as the heuristic. */
export const createOllamaEntityExtractor = (generate: (prompt: string) => Promise<string>): EntityExtractor =>
  async (text) => parseEntityReply(await generate(PROMPT + text.slice(0, OLLAMA_ENTITY_PROFILE.maxChars)));
