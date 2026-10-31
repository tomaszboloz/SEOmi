import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { validProjectId } from '@/services/schedules/policy';
import { CLAIM_BACKED_PROFILE, SCORING_PROFILE, type ScoringProfile } from './types';

/** Per-project opt-in to the claim-backed-v1 reference sub-scoring (#65, #87, #88). Legacy stays the default. */
export const scoringProfileKey = (projectId: string): string => `seomi_project_${projectId}_eeat_scoring_profile_v1`;

export const readScoringProfile = (projectId: string | null | undefined): ScoringProfile => (
  projectId && validProjectId(projectId) && readJsonStorage(scoringProfileKey(projectId), SCORING_PROFILE) === CLAIM_BACKED_PROFILE
    ? CLAIM_BACKED_PROFILE : SCORING_PROFILE
);

/** False when the project id is unusable or storage refused the write. */
export const saveScoringProfile = (projectId: string | null | undefined, profile: ScoringProfile): boolean => (
  Boolean(projectId && validProjectId(projectId)) && writeJsonStorage(scoringProfileKey(projectId as string), profile)
);
