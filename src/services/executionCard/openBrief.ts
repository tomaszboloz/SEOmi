import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { useToolsStore } from '@/stores/toolsStore';

let pending: string | null = null;

/** Brief node the Brief Workstation should select as soon as it mounts. */
export const takePendingBrief = (): string | null => { const id = pending; pending = null; return id; };

export const semanticMapKey = (projectId: string, runId: string) => `seomi_project_${projectId}_semantic_map_${runId}_v1`;

/** Remembers the node and switches the saved map view to the plan workspace; the caller then opens the map tab. */
export const prepareBriefNavigation = (projectId: string | null, nodeId: string): void => {
  pending = nodeId;
  if (!projectId) return;
  const key = semanticMapKey(projectId, useToolsStore.getState().selectedCrawlRunId ?? 'current');
  const saved = readJsonStorage(key, null);
  const base = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  writeJsonStorage(key, { ...base, activeView: 'plan' });
};
