export const CAUSAL_STORAGE_EVENT = 'seomi:causal-storage';

export const dispatchCausalStorageEvent = (key: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CAUSAL_STORAGE_EVENT, { detail: { key } }));
  } catch {
    // Ignore event dispatch errors in restricted environments.
  }
};

const PATCHED_KEY = '__seomiStoragePatched__';

export const installCausalStorageInterceptor = (): void => {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return;
  try {
    const proto = Storage.prototype;
    if ((proto as unknown as Record<string, unknown>)[PATCHED_KEY]) return;

    const isLocalStorage = (target: unknown): boolean =>
      typeof window !== 'undefined' && target === window.localStorage;

    const origSet = proto.setItem;
    const origRemove = proto.removeItem;
    const origClear = proto.clear;

    proto.setItem = function (...args: [string, string]): void {
      origSet.apply(this, args);
      if (isLocalStorage(this)) {
        dispatchCausalStorageEvent(args[0]);
      }
    };

    proto.removeItem = function (...args: [string]): void {
      origRemove.apply(this, args);
      if (isLocalStorage(this)) {
        dispatchCausalStorageEvent(args[0]);
      }
    };

    proto.clear = function (...args: []): void {
      origClear.apply(this, args);
      if (isLocalStorage(this)) {
        dispatchCausalStorageEvent(null);
      }
    };

    Object.defineProperty(proto, PATCHED_KEY, {
      value: true,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    // Graceful fallback if Storage.prototype is frozen or read-only
  }
};

installCausalStorageInterceptor();
