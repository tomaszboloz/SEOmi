import { useCallback, useState } from 'react';
import { createBriefDeps } from '@/services/siteFocusBenchmark/adapter';
import { withOllamaFallback } from '@/services/aioReadiness/rewriteDeps';
import type { ClaimCitation } from '@/services/citationEvidence/claims';
import { heuristicEntailment, modelEntailment, type EntailmentResult } from '@/services/citationEvidence/entailment';
import { readStorage, writeStorage } from '@/services/storage';

const key = (projectId: string | null | undefined): string => `seomi_project_${encodeURIComponent(projectId ?? 'none')}_entailment_model_v1`;
export const readEntailmentModelSetting = (projectId: string | null | undefined): boolean => readStorage(key(projectId)) === '1';

/** Opt-in entailment run (#88). Heuristic by default; model path only when the project setting is on. */
export const useEntailmentCheck = (claims: ClaimCitation[], projectId?: string | null) => {
  const [useModel, setUseModelState] = useState(() => readEntailmentModelSetting(projectId));
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<EntailmentResult[]>([]);
  const setUseModel = useCallback((value: boolean) => { writeStorage(key(projectId), value ? '1' : '0'); setUseModelState(value); }, [projectId]);
  const run = useCallback(async (source: string) => {
    setBusy(true);
    const deps = withOllamaFallback(createBriefDeps(), projectId);
    const out = await Promise.all(claims.slice(0, 12).map((c) => (useModel ? modelEntailment(deps, c.claim, source) : Promise.resolve(heuristicEntailment(c.claim, source)))));
    setResults(out);
    setBusy(false);
  }, [claims, projectId, useModel]);
  return { useModel, setUseModel, busy, results, run };
};
