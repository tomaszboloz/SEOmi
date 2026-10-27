import type { RegistryFetcher, RegistryResponse } from './registry';

/** Enforces the caller deadline even when an IPC transport cannot cancel its bounded native request. */
export const requestRegistry = (fetcher: RegistryFetcher, url: string, signal: AbortSignal): Promise<RegistryResponse> => {
  if (signal.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(() => fetcher(url, signal)).then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
};
