import { create } from 'zustand';
import type { ToolsState } from './tools/contracts';
export type { RankTrackingDraft } from './tools/contracts';
import { toolsServices } from './tools/services';
import { createToolsInitialState } from './tools/initialState';
import { createAiSlice } from './tools/aiSlice';
import { createKeywordSlice } from './tools/keywordSlice';
import { createDomainSlice } from './tools/domainSlice';
import { createBacklinksSlice } from './tools/backlinksSlice';
import { createCrawlProfilesSlice } from './tools/crawlProfilesSlice';
import { createCrawlSlice } from './tools/crawlSlice';
import { createCrawlHistorySlice } from './tools/crawlHistorySlice';
import { createExternalLinksSlice } from './tools/externalLinksSlice';
import { createGscSlice } from './tools/gscSlice';
import { createHydrationSlice } from './tools/hydrationSlice';
export const useToolsStore = create<ToolsState>((set, get) => ({
...createToolsInitialState(),
...createAiSlice(set, get, toolsServices),
...createKeywordSlice(set, get, toolsServices),
...createDomainSlice(set, get, toolsServices),
...createBacklinksSlice(set, get, toolsServices),
...createCrawlProfilesSlice(set, get, toolsServices),
...createCrawlSlice(set, get, toolsServices),
...createCrawlHistorySlice(set, get, toolsServices),
...createExternalLinksSlice(set, get, toolsServices),
...createGscSlice(set, get, toolsServices),
...createHydrationSlice(set, get, toolsServices),
}));
