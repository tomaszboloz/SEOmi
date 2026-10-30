import { useEffect, useRef, useState } from 'react';
import type { ClaimCitation } from '@/services/citationEvidence/claims';
import { checkReachability, reachabilityTargets, type LinkChecker, type LinkStatus, type Reachability } from '@/services/citationEvidence/support';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';

export type ReachabilityRun = 'idle' | 'busy' | 'done' | 'desktop-only';

const nativeChecker: LinkChecker = (url) => invokeTauriCommand<LinkStatus>('check_link', { url, timeoutSecs: 8 });

/**
 * Opt-in reachability check of the cited works (#88). Nothing is requested until `check` is called; a
 * new claim list cancels and discards an in-flight check, so late answers never land on other claims.
 */
export const useSourceReachability = (claims: ClaimCitation[], checker: LinkChecker = nativeChecker, native = isTauriEnvironment) => {
  const [state, setState] = useState<{ run: ReachabilityRun; results: Record<string, Reachability> }>({ run: 'idle', results: {} });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setState({ run: 'idle', results: {} });
    return () => controller.current?.abort();
  }, [claims]);
  const check = async (): Promise<void> => {
    if (!native()) { setState({ run: 'desktop-only', results: {} }); return; }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setState({ run: 'busy', results: {} });
    const results = await checkReachability(reachabilityTargets(claims), checker, active.signal);
    if (!active.signal.aborted) setState({ run: 'done', results });
  };
  return { ...state, targets: reachabilityTargets(claims).length, check };
};
