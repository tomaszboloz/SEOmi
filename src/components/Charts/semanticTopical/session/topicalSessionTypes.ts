import { readTopicalMap, writeTopicalMap } from '@/services/topicalMap';
import { readTopicalWorkspacePreferences } from '../workspaceHelpers';
import { writeJsonStorage } from '@/services/storage';

export interface TopicalSessionDependencies {
  readMap: typeof readTopicalMap;
  writeMap: typeof writeTopicalMap;
  readPreferences: typeof readTopicalWorkspacePreferences;
  writePreferences: typeof writeJsonStorage;
}

export const defaultSessionDependencies: TopicalSessionDependencies = {
  readMap: readTopicalMap,
  writeMap: writeTopicalMap,
  readPreferences: readTopicalWorkspacePreferences,
  writePreferences: writeJsonStorage,
};
