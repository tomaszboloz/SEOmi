import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrawledPageSummary } from '@/types';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';

/** Per-device preference; off unless the user opts in (#131). */
export const SPA_AUTO_RENDER_KEY = 'seomi_spa_auto_render_v1';

export const readSpaAutoRender = (): boolean => readJsonStorage(SPA_AUTO_RENDER_KEY, false) === true;

/**
 * Opt-in automatic render of flagged shells. Decision (default chosen by agent): disabled by default, because
 * every render opens a WebView for up to a minute; when enabled it starts the same capped batch once per crawl
 * page list, never restarts a batch the user cancelled, and never changes crawl scores.
 */
export const useSpaAutoRender = (shells: CrawledPageSummary[], enabledEnvironment: boolean, idle: boolean, start: () => void) => {
  const [auto, setAutoState] = useState(readSpaAutoRender);
  const started = useRef<CrawledPageSummary[] | null>(null);
  useEffect(() => {
    if (!auto || !enabledEnvironment || !idle || shells.length === 0 || started.current === shells) return;
    started.current = shells;
    start();
  }, [auto, enabledEnvironment, idle, shells, start]);
  const setAuto = useCallback((value: boolean) => {
    setAutoState(value);
    writeJsonStorage(SPA_AUTO_RENDER_KEY, value);
  }, []);
  return { auto, setAuto };
};
