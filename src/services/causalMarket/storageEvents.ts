export const CAUSAL_STORAGE_EVENT = 'seomi:causal-storage';

export const dispatchCausalStorageEvent = (key: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CAUSAL_STORAGE_EVENT, { detail: { key } }));
  } catch {
    // Ignore event dispatch errors in restricted environments.
  }
};

export const installCausalStorageInterceptor = (): void => {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return;
  const proto = Storage.prototype;
  if ((proto.setItem as { __seomiPatched?: boolean }).__seomiPatched) return;

  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  const origClear = proto.clear;

  proto.setItem = function (key: string, value: string): void {
    origSet.apply(this, [key, value]);
    dispatchCausalStorageEvent(key);
  };
  (proto.setItem as { __seomiPatched?: boolean }).__seomiPatched = true;

  proto.removeItem = function (key: string): void {
    origRemove.apply(this, [key]);
    dispatchCausalStorageEvent(key);
  };

  proto.clear = function (): void {
    origClear.apply(this);
    dispatchCausalStorageEvent(null);
  };
};

installCausalStorageInterceptor();
