/** Best-effort WebView storage adapter. A locked-down desktop profile must
 * keep the in-memory workspace usable when localStorage is unavailable. */
export const readStorage = (key: string): string | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const isStorageAvailable = (): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.getItem('__seomi_storage_probe__');
    return true;
  } catch {
    return false;
  }
};

export interface StorageWriteResult { ok: boolean; error?: unknown }

export const writeStorageResult = (key: string, value: string): StorageWriteResult => {
  try {
    if (typeof localStorage === 'undefined') return { ok: false };
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};

export const writeStorage = (key: string, value: string): boolean => writeStorageResult(key, value).ok;

export const removeStorage = (key: string): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

/** Decode untrusted JSON. Callers must validate the returned value before use. */
export const readJsonStorage = (key: string, fallback: unknown): unknown => {
  const raw = readStorage(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeJsonStorage = (key: string, value: unknown): boolean => {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    // JSON.stringify can fail for an accidentally supplied cyclic value.
    return false;
  }
};

/** Enumerate only a bounded project prefix for backup/export workflows. */
export const readStorageEntries = (prefix: string, maxEntries = 5000): Record<string, string> => {
  const entries: Record<string, string> = {};
  let entryCount = 0;
  const limit = Math.min(5000, Math.max(0, Number.isFinite(maxEntries) ? Math.floor(maxEntries) : 0));
  try {
    if (typeof localStorage === 'undefined') return entries;
    for (let index = 0; index < localStorage.length && entryCount < limit; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) {
        const suffix = key.slice(prefix.length);
        if (!Object.prototype.hasOwnProperty.call(entries, suffix)) entryCount += 1;
        Object.defineProperty(entries, suffix, { value, enumerable: true, configurable: true, writable: true });
      }
    }
  } catch {
    // A locked-down WebView can reject enumeration. Return the safe partial
    // snapshot gathered before the operation failed.
  }
  return entries;
};

const readEphemeralStorage = (key: string): string | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeEphemeralStorage = (key: string, value: string): boolean => {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const removeEphemeralStorage = (key: string): boolean => {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export { readEphemeralStorage, writeEphemeralStorage, removeEphemeralStorage };
