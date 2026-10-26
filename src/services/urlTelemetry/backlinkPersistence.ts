import { parseBacklinkProfile, parseBacklinkSnapshot, parseResearchHistory } from '@/services/researchContracts';
import { readJsonStorage } from '@/services/storage';
import type { BacklinkProfileData, BacklinkProfileHistory } from '@/types';
import type { SnapshotInput } from './snapshot';

export const backlinkProfileKey = (projectId: string) => `seomi_project_${projectId}_backlink_profile_v1`;
export const backlinkProfileHistoryKey = (projectId: string) => `seomi_project_${projectId}_backlink_profile_history_v1`;

export const loadBacklinkProfile = (projectId: string): BacklinkProfileData | null =>
  parseBacklinkProfile(readJsonStorage(backlinkProfileKey(projectId), null));

export const normalizeBacklinkProfileHistory = (value: unknown): BacklinkProfileHistory =>
  parseResearchHistory(value, parseBacklinkSnapshot, 12, 'last');

export const loadBacklinkProfileHistory = (projectId: string): BacklinkProfileHistory =>
  normalizeBacklinkProfileHistory(readJsonStorage(backlinkProfileHistoryKey(projectId), null));

export const readBacklinkTelemetry = (projectId: string): Pick<SnapshotInput, 'backlinks' | 'backlinkProvider' | 'backlinkRetrievedAt'> => {
  const backlinks = loadBacklinkProfile(projectId);
  if (!backlinks) return { backlinks: null };
  const captured = loadBacklinkProfileHistory(projectId).reverse().find((snapshot) =>
    snapshot.domain === backlinks.domain && Number.isFinite(Date.parse(snapshot.retrieved_at)));
  return { backlinks, backlinkProvider: 'DataForSEO', backlinkRetrievedAt: captured?.retrieved_at };
};
