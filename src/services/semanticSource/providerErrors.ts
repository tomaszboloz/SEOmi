/**
 * Provider failure contract (#86 GEM-86-03/08, T01, T05). Every embedding/SERP failure maps to a reason
 * code the UI can translate, and the message is redacted before it reaches the WebView, logs or reports:
 * keys, bearer tokens, URL credentials and secret query parameters never leave the native boundary.
 */
export type ProviderFailure = 'cancelled' | 'timeout' | 'offline' | 'model-missing' | 'rate-limited' | 'invalid-response' | 'failed';

export interface ProviderError { code: ProviderFailure; message: string }

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:sk|pk|rk)-(?:proj-|ant-)?[A-Za-z0-9_-]{12,}/gu, '[redacted key]'],
  [/\bAIza[0-9A-Za-z_-]{20,}/gu, '[redacted key]'],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/giu, '$1 [redacted]'],
  [/(\/\/)[^\s/:@]+:[^\s/@]+@/gu, '$1[redacted]@'],
  [/([?&](?:api[_-]?key|key|token|access_token|password|secret|signature)=)[^&\s#]+/giu, '$1[redacted]'],
  [/((?<![?&\w])"?(?:api[_-]?key|password|secret|token|authorization)"?\s*[:=]\s*"?)(?!\[redacted)[^"\s,}&]+/giu, '$1[redacted]'],
];

export const redactSecrets = (text: string): string =>
  SECRET_PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);

const MESSAGE_LIMIT = 300;

export const classifyProviderError = (error: unknown): ProviderError => {
  const name = error instanceof Error ? error.name : '';
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const message = redactSecrets(raw).slice(0, MESSAGE_LIMIT);
  const code: ProviderFailure =
    name === 'AbortError' || /cancel/iu.test(raw) ? 'cancelled'
      : name === 'TimeoutError' || /timed? ?out/iu.test(raw) ? 'timeout'
        : /\b429\b|rate.?limit|too many requests/iu.test(raw) ? 'rate-limited'
          : /cannot reach|failed to fetch|network|ECONNREFUSED|offline/iu.test(raw) ? 'offline'
            : /model .*not found|not found, try pulling|\b404\b/iu.test(raw) ? 'model-missing'
              : /unexpected number|invalid embedding|different sizes|returned no/iu.test(raw) ? 'invalid-response'
                : 'failed';
  return { code, message };
};

/** Rejects after `ms` with a TimeoutError; aborting the signal rejects with an AbortError. */
export const withTimeout = <T>(work: Promise<T>, ms: number | undefined, signal?: AbortSignal): Promise<T> => {
  if (!ms && !signal) return work;
  return new Promise<T>((resolve, reject) => {
    const timer = ms ? setTimeout(() => reject(Object.assign(new Error(`Provider timed out after ${ms} ms`), { name: 'TimeoutError' })), ms) : undefined;
    const onAbort = () => reject(Object.assign(new Error('Provider request cancelled'), { name: 'AbortError' }));
    signal?.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    });
  });
};
