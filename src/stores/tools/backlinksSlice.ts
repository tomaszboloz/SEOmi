import type { ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { createBacklinkProfileActions } from './backlinks/profile';
import { createBacklinkGapActions } from './backlinks/gap';

export const createBacklinksSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices) => ({
  ...createBacklinkProfileActions(set, get, services),
  ...createBacklinkGapActions(set, get, services),
});
