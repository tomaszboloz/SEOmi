import type { OllamaOptions } from './ollama.ts';

export const MAX_OLLAMA_RESPONSE_BYTES = 8 * 1024 * 1024;
export const MAX_OLLAMA_TIMEOUT_MS = 300_000;
export const MAX_OLLAMA_BATCH_SIZE = 128;

export const boundedOllamaInteger = (value: number, maximum: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid Ollama ${label}: expected integer 1..${maximum}`);
  return value;
};

/** An endpoint must be an origin; never silently discard path or query configuration. */
export const ollamaBaseUrl = (value = 'http://127.0.0.1:11434'): string => {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Ollama URL must use http or https');
  if (url.username || url.password) throw new Error('Ollama URL must not contain credentials');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Ollama URL must be an origin without path, query or fragment');
  return url.origin;
};

export const ollamaSettings = (options: OllamaOptions) => ({
  baseUrl: ollamaBaseUrl(options.baseUrl),
  timeoutMs: boundedOllamaInteger(options.timeoutMs ?? 60_000, MAX_OLLAMA_TIMEOUT_MS, 'timeout'),
  fetchImpl: options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init)),
});

/** The deadline applies even to a supplied adapter that does not honor AbortSignal. */
const beforeDeadline = async <T>(operation: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw new Error('Ollama request timed out');
  let stop!: () => void;
  const deadline = new Promise<never>((_, reject) => {
    stop = () => reject(new Error('Ollama request timed out'));
    signal.addEventListener('abort', stop, { once: true });
  });
  try { return await Promise.race([operation, deadline]); }
  finally { signal.removeEventListener('abort', stop); }
};

const cancelBody = (body: ReadableStream<Uint8Array> | null) => { void body?.cancel().catch(() => undefined); };

export const postOllama = async (options: ReturnType<typeof ollamaSettings>, path: string, body: unknown): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let bytes = 0;
  try {
    let response: Response;
    const request = Promise.resolve().then(() => options.fetchImpl(`${options.baseUrl}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
    }));
    // Dispose an adapter response that resolves only after the operation expired.
    void request.then((late) => { if (controller.signal.aborted) cancelBody(late.body); }, () => undefined);
    try { response = await beforeDeadline(request, controller.signal); }
    catch { throw new Error(`Cannot reach Ollama at ${options.baseUrl}. Start it with "ollama serve" and pull the model, e.g. "ollama pull nomic-embed-text".`); }
    if (!response.ok) {
      cancelBody(response.body);
      throw new Error(`Ollama ${path} returned HTTP ${response.status}`);
    }
    reader = response.body?.getReader();
    if (!reader) throw new Error('Ollama returned an invalid response');
    const chunks: Uint8Array[] = [];
    let value: unknown;
    try {
      for (;;) {
        const chunk = await beforeDeadline(reader.read(), controller.signal);
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_OLLAMA_RESPONSE_BYTES) throw new Error('Ollama response too large');
        chunks.push(chunk.value);
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    } catch {
      void reader.cancel().catch(() => undefined);
      if (controller.signal.aborted) throw new Error('Ollama request timed out');
      if (bytes > MAX_OLLAMA_RESPONSE_BYTES) throw new Error('Ollama response too large');
      throw new Error('Ollama returned an invalid response');
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ollama returned an invalid response');
    return value as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
};

/** Bounded JSON GET for discovery endpoints; errors never include response bodies. */
export const getOllama = async (options: ReturnType<typeof ollamaSettings>, path: string): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let bytes = 0;
  try {
    const request = Promise.resolve().then(() => options.fetchImpl(`${options.baseUrl}${path}`, {
      method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal,
    }));
    let response: Response;
    void request.then((late) => { if (controller.signal.aborted) cancelBody(late.body); }, () => undefined);
    try { response = await beforeDeadline(request, controller.signal); }
    catch { throw new Error(`Cannot reach Ollama at ${options.baseUrl}`); }
    if (!response.ok) {
      cancelBody(response.body);
      throw new Error(`Ollama ${path} returned HTTP ${response.status}`);
    }
    reader = response.body?.getReader();
    if (!reader) throw new Error('Ollama returned an invalid response');
    const chunks: Uint8Array[] = [];
    let value: unknown;
    try {
      for (;;) {
        const chunk = await beforeDeadline(reader.read(), controller.signal);
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_OLLAMA_RESPONSE_BYTES) throw new Error('Ollama response too large');
        chunks.push(chunk.value);
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    } catch {
      void reader.cancel().catch(() => undefined);
      if (controller.signal.aborted) throw new Error('Ollama request timed out');
      if (bytes > MAX_OLLAMA_RESPONSE_BYTES) throw new Error('Ollama response too large');
      throw new Error('Ollama returned an invalid response');
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ollama returned an invalid response');
    return value as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
    reader?.releaseLock();
  }
};
