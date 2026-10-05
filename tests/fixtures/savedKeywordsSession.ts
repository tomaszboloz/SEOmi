import { create } from 'zustand';
import { vi } from 'vitest';
import type { SavedKeywordItem } from '@/types';

export const keyword = (id: string, overrides: Partial<SavedKeywordItem> = {}): SavedKeywordItem => ({
  id, keyword: `Keyword ${id}`, search_volume: 100, difficulty: 20, cpc: 2,
  intent: 'Commercial', tags: ['priority'], addedAt: '2026-10-04', ...overrides,
});
export const project = create<{ activeProjectId: string | null }>(() => ({ activeProjectId: 'one' }));
export const updateTags = vi.fn();
export const removeKeyword = vi.fn();
export const tools = create(() => ({
  savedKeywords: [] as SavedKeywordItem[], updateKeywordTags: updateTags, removeSavedKeyword: removeKeyword,
}));
export const setTab = vi.fn();
export const audit = create(() => ({ setActiveTab: setTab }));
export function resetKeywords() {
  project.setState({ activeProjectId: 'one' });
  tools.setState({ savedKeywords: [] });
  updateTags.mockReset(); removeKeyword.mockReset(); setTab.mockReset();
}
