import type { ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { createCrawlExecutionActions } from './crawl/execution';
import { createCrawlControlsActions } from './crawl/controls';
import { createCrawlHistoryActions } from './crawl/history';

export const createCrawlSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices) => ({
  ...createCrawlExecutionActions(set, get, services),
  ...createCrawlControlsActions(set, get, services),
  ...createCrawlHistoryActions(set, get, services),
});
