import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type RouteModule<T extends ComponentType<any>> = { default: T };
type RouteLoader<T extends ComponentType<any>> = () => Promise<RouteModule<T>>;

const CHUNK_LOAD_ERROR = /failed to fetch dynamically imported module|importing a module script failed|unable to preload css|chunkloaderror/i;
const RECOVERY_STORAGE_KEY = "seomi:chunk-recovery-at";
const RECOVERY_WINDOW_MS = 30_000;

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, delayMs));

export const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_LOAD_ERROR.test(message);
};

/**
 * A Tauri update can leave the WebView holding an old index that references
 * chunks no longer embedded in the new binary. Reload once per short window;
 * the guard prevents an endlessly looping reload when the package is broken.
 */
export const recoverFromChunkLoad = (error: unknown): boolean => {
  if (!isChunkLoadError(error) || typeof window === "undefined" || window.location.hostname !== "tauri.localhost") return false;
  try {
    const previous = Number(window.sessionStorage.getItem(RECOVERY_STORAGE_KEY) ?? 0);
    const now = Date.now();
    if (previous > 0 && now - previous < RECOVERY_WINDOW_MS) return false;
    window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
};

/** Vite emits this event before rejecting a stale dynamic import. */
export const installChunkLoadRecovery = (): (() => void) | undefined => {
  if (typeof window === "undefined") return undefined;
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    recoverFromChunkLoad(new Error("Failed to fetch dynamically imported module"));
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
};

/**
 * Load a route chunk with one bounded retry. A transient WebView/network
 * failure should not turn a valid workspace route into a permanent error;
 * keeping the retry bounded also prevents an import loop when a deployment
 * really is broken.
 */
export const loadRouteModule = async <T extends ComponentType<any>>(
  loader: RouteLoader<T>,
  retries = 1,
  delayMs = 120,
): Promise<RouteModule<T>> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(delayMs);
      else recoverFromChunkLoad(error);
    }
  }
  throw lastError;
};

export const lazyRoute = <T extends ComponentType<any>>(
  loader: RouteLoader<T>,
): LazyExoticComponent<T> => lazy(() => loadRouteModule(loader));
