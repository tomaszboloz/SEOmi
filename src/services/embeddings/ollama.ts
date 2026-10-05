import type { EmbeddingProvider } from './types.ts';
import { normalize } from './vector.ts';

export interface OllamaOptions {
  /** Ollama server, default http://127.0.0.1:11434. LAN hosts are allowed. */
  baseUrl?: string;
  /** Embedding model, e.g. `nomic-embed-text`, `bge-m3`, `mxbai-embed-large`. */
  model?: string;
  timeoutMs?: number;
  batchSize?: number;
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
}

const MAX_RESPONSE_TEXT = 20_000;

/** Validates the server URL: http(s) only, no embedded credentials, no path. */
export const ollamaBaseUrl = (value = 'http://127.0.0.1:11434'): string => {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Ollama URL must use http or https');
  if (url.username || url.password) throw new Error('Ollama URL must not contain credentials');
  return `${url.protocol}//${url.host}`;
};

const post = async (options: Required<Pick<OllamaOptions, 'timeoutMs' | 'fetchImpl'>> & { baseUrl: string }, path: string, body: unknown): Promise<unknown> => {
  let response: Response;
  try {
    response = await options.fetchImpl(`${options.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reach Ollama at ${options.baseUrl} (${cause}). Start it with "ollama serve" and pull the model, e.g. "ollama pull nomic-embed-text".`, { cause: error });
  }
  if (!response.ok) throw new Error(`Ollama ${path} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
};

const settings = (options: OllamaOptions) => ({
  baseUrl: ollamaBaseUrl(options.baseUrl),
  timeoutMs: options.timeoutMs ?? 60_000,
  fetchImpl: options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init)),
});

/** Embeddings from a local Ollama model (`POST /api/embed`). */
export const createOllamaEmbeddingProvider = (options: OllamaOptions = {}): EmbeddingProvider => {
  const resolved = settings(options);
  const model = options.model ?? 'nomic-embed-text';
  const batchSize = Math.max(1, options.batchSize ?? 32);
  return {
    id: 'ollama',
    model,
    async embed(texts: string[]) {
      const vectors = [];
      let dimensions = 0;
      for (let start = 0; start < texts.length; start += batchSize) {
        const batch = texts.slice(start, start + batchSize);
        const body = await post(resolved, '/api/embed', { model, input: batch }) as { embeddings?: unknown };
        const embeddings = body.embeddings;
        if (!Array.isArray(embeddings) || embeddings.length !== batch.length) throw new Error('Ollama returned an unexpected number of embeddings');
        for (const values of embeddings) {
          if (!Array.isArray(values) || !values.length || !values.every((value) => typeof value === 'number' && Number.isFinite(value))) throw new Error('Ollama returned an invalid embedding');
          dimensions ||= values.length;
          if (values.length !== dimensions) throw new Error('Ollama returned embeddings of different sizes');
          vectors.push(normalize(values));
        }
      }
      return vectors;
    },
  };
};

/** Optional text generation (`POST /api/generate`), e.g. for naming clusters. */
export const createOllamaGenerator = (options: OllamaOptions = {}) => {
  const resolved = settings(options);
  const model = options.model ?? 'llama3.2';
  return async (prompt: string): Promise<string> => {
    const body = await post(resolved, '/api/generate', { model, prompt, stream: false, options: { temperature: 0 } }) as { response?: unknown };
    if (typeof body.response !== 'string') throw new Error('Ollama returned no text');
    return body.response.trim().slice(0, MAX_RESPONSE_TEXT);
  };
};
