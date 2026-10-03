import { SavedKeywordItem } from '@/types';
import { createId } from '@/services/ids';
import { writeJsonStorage } from '@/services/storage';
import type { ToolsState, ToolsSet, ToolsGet } from '../contracts';
import { savedKeywordsKey, activeProjectId } from '../storageKeys';

export const createKeywordSavedActions = (set: ToolsSet, get: ToolsGet): Pick<ToolsState, "addSavedKeyword" | "removeSavedKeyword" | "updateKeywordTags"> => ({
addSavedKeyword: (item) => {
    const existing = get().savedKeywords;
    if (existing.some((k) => k.keyword.toLowerCase() === item.keyword.toLowerCase())) {
      return;
    }
    const newItem: SavedKeywordItem = {
      ...item,
      id: createId('k'),
      addedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...existing];
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },
removeSavedKeyword: (id) => {
    const updated = get().savedKeywords.filter((k) => k.id !== id);
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  },
updateKeywordTags: (id, tags) => {
    const updated = get().savedKeywords.map((k) => (k.id === id ? { ...k, tags } : k));
    const projectId = activeProjectId();
    if (projectId) writeJsonStorage(savedKeywordsKey(projectId), updated);
    set({ savedKeywords: updated });
  }
});
