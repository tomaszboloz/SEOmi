import type { ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { createKeywordQueryActions } from './keywords/query';
import { createKeywordSavedActions } from './keywords/saved';
import { createKeywordRanksActions } from './keywords/ranks';

export const createKeywordSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices) => ({
  ...createKeywordQueryActions(set, get, services),
  ...createKeywordSavedActions(set, get),
  ...createKeywordRanksActions(set, get, services),
});
