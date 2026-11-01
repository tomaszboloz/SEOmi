/** The single AI brief runner (#106): provider check, cache, cancellation and error mapping in one place. */
export interface BriefTextDeps {
  /** Missing or returning false means no AI provider is connected. */
  isConfigured: () => boolean;
  generateText: (prompt: string) => Promise<string>;
}

export type AiBriefOutcome =
  | { status: 'ok'; text: string; cached: boolean }
  | { status: 'no-key' }
  | { status: 'empty' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type BriefCache = Map<string, { prompt: string; text: string }>;

export interface AiBriefRun {
  deps: BriefTextDeps;
  prompt: string;
  sanitize: (raw: string) => string;
  signal?: AbortSignal;
  /** Optional in-memory cache; a hit needs the same prompt and no `force`. */
  cache?: { store: BriefCache; key: string; force?: boolean };
  /** Passage rewrites report a cancellation before a missing provider; briefs the other way round. */
  cancelBeforeProvider?: boolean;
}

const abortable = <T,>(work: Promise<T>, signal?: AbortSignal): Promise<T> => signal
  ? new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new DOMException('aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  }) : work;

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export const runAiBrief = async ({ deps, prompt, sanitize, signal, cache, cancelBeforeProvider }: AiBriefRun): Promise<AiBriefOutcome> => {
  const hit = cache?.store.get(cache.key);
  if (cache && hit && hit.prompt === prompt && !cache.force) return { status: 'ok', text: hit.text, cached: true };
  if (cancelBeforeProvider && signal?.aborted) return { status: 'cancelled' };
  if (!deps.isConfigured()) return { status: 'no-key' };
  if (signal?.aborted) return { status: 'cancelled' };
  try {
    const text = sanitize(await abortable(deps.generateText(prompt), signal));
    if (signal?.aborted) return { status: 'cancelled' };
    if (!text) return { status: 'empty' };
    cache?.store.set(cache.key, { prompt, text });
    return { status: 'ok', text, cached: false };
  } catch (error) {
    if (signal?.aborted || isAbort(error)) return { status: 'cancelled' };
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
};
