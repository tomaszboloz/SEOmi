import { useCallback, useState } from 'react';
import { readScoringProfile, saveScoringProfile, type ScoringProfile } from '@/services/eeatTrust';

/** Project's EETV sub-scoring profile; a change is stored per project and applies to the current view at once. */
export const useScoringProfile = (projectId: string | null | undefined): [ScoringProfile, (next: ScoringProfile) => void] => {
  const [state, setState] = useState(() => ({ projectId, profile: readScoringProfile(projectId) }));
  const profile = state.projectId === projectId ? state.profile : readScoringProfile(projectId);
  const change = useCallback((next: ScoringProfile) => {
    saveScoringProfile(projectId, next);
    setState({ projectId, profile: next });
  }, [projectId]);
  return [profile, change];
};
