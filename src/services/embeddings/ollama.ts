import type { EmbeddingProvider } from './types.ts';
import { normalize } from './vector.ts';
import { boundedOllamaInteger, MAX_OLLAMA_BATCH_SIZE, ollamaSettings, postOllama } from './ollamaTransport.ts';
export { ollamaBaseUrl } from './ollamaTransport.ts';

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

/** Embeddings from a local Ollama model (`POST /api/embed`). */
export const createOllamaEmbeddingProvider = (options: OllamaOptions = {}): EmbeddingProvider => {
  const resolved = ollamaSettings(options);
  const model = options.model ?? 'nomic-embed-text';
  const batchSize = boundedOllamaInteger(options.batchSize ?? 32, MAX_OLLAMA_BATCH_SIZE, 'batch size');
  return {
    id: 'ollama',
    model,
    async embed(texts: string[]) {
      const vectors = [];
      let dimensions = 0;
      for (let start = 0; start < texts.length; start += batchSize) {
        const batch = texts.slice(start, start + batchSize);
        const body = await postOllama(resolved, '/api/embed', { model, input: batch }) as { embeddings?: unknown };
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
  const resolved = ollamaSettings(options);
  const model = options.model ?? 'llama3.2';
  return async (prompt: string): Promise<string> => {
    const body = await postOllama(resolved, '/api/generate', { model, prompt, stream: false, options: { temperature: 0 } }) as { response?: unknown };
    if (typeof body.response !== 'string') throw new Error('Ollama returned no text');
    return body.response.trim().slice(0, MAX_RESPONSE_TEXT);
  };
};
