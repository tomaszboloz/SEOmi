import type { ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { createAiBrandActions } from './ai/brand';
import { createAiPromptsActions } from './ai/prompts';

export const createAiSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices) => ({
  ...createAiBrandActions(set, get, services),
  ...createAiPromptsActions(set, get, services),
});
