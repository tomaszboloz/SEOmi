import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import { keyword, tools, project, updateTags, removeKeyword, setTab, resetKeywords } from './fixtures/savedKeywordsSession';

vi.mock('@/stores/toolsStore', async () => ({ useToolsStore: (await import('./fixtures/savedKeywordsSession')).tools }));
vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/savedKeywordsSession')).project }));
vi.mock('@/stores/auditStore', async () => ({ useAuditStore: (await import('./fixtures/savedKeywordsSession')).audit }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: vi.fn() } }));
beforeEach(resetKeywords);
afterEach(() => vi.restoreAllMocks());

it('returns empty aggregates and action delegates', () => {
  const { result } = renderHook(useSavedKeywordsSession);
  expect(result.current).toMatchObject({ totalKeywords: 0, totalVolume: 0, avgDifficulty: 0, estMonthlyValue: 0, allTags: [], filteredList: [] });
  act(() => result.current.removeSavedKeyword('one'));
  act(() => result.current.setActiveTab('overview'));
  expect(removeKeyword).toHaveBeenCalledWith('one');
  expect(setTab).toHaveBeenCalledWith('overview');
});

it('computes observed aggregates and unique tags, filters by query and exact tag', () => {
  const first = keyword('a', { keyword: 'SEO Audit', tags: ['priority', 'Local'], difficulty: 21 });
  const second = keyword('b', { tags: ['Local'], search_volume: 200, difficulty: 40, cpc: 3 });
  tools.setState({ savedKeywords: [first, second] });
  const { result } = renderHook(useSavedKeywordsSession);
  expect(result.current).toMatchObject({ totalKeywords: 2, totalVolume: 300, avgDifficulty: 31, estMonthlyValue: 40, allTags: ['priority', 'Local'] });
  act(() => result.current.setSearchFilter('AUDIT'));
  expect(result.current.filteredList).toEqual([first]);
  act(() => result.current.setSearchFilter('local'));
  expect(result.current.filteredList).toEqual([first, second]);
  act(() => result.current.setActiveTagFilter('priority'));
  expect(result.current.filteredList).toEqual([first]);
  act(() => result.current.setActiveTagFilter('local'));
  expect(result.current.filteredList).toEqual([]);
  act(() => result.current.setActiveTagFilter(null));
  act(() => result.current.setSearchFilter('missing'));
  expect(result.current.filteredList).toEqual([]);
});

it('clears all filter and tag drafts when the active project changes', () => {
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => {
    result.current.setSearchFilter('query'); result.current.setActiveTagFilter('tag');
    result.current.setNewTagInput({ id: 'a', tag: 'draft' });
  });
  act(() => project.setState({ activeProjectId: 'two' }));
  expect(result.current).toMatchObject({ searchFilter: '', activeTagFilter: null, newTagInput: null });
});

it('adds trimmed tags, clears accepted drafts and skips duplicates', () => {
  tools.setState({ savedKeywords: [keyword('a')] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.setNewTagInput({ id: 'a', tag: ' new ' }));
  act(() => result.current.handleAddTag('a'));
  expect(updateTags).toHaveBeenCalledExactlyOnceWith('a', ['priority', 'new']);
  expect(result.current.newTagInput).toBeNull();
  updateTags.mockClear();
  act(() => result.current.setNewTagInput({ id: 'a', tag: 'priority' }));
  act(() => result.current.handleAddTag('a'));
  expect(updateTags).not.toHaveBeenCalled();
  expect(result.current.newTagInput).toBeNull();
});

it('rejects absent, empty, unknown and mismatched tag drafts without modifying another row', () => {
  tools.setState({ savedKeywords: [keyword('a'), keyword('b')] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.handleAddTag('a'));
  for (const draft of [{ id: 'a', tag: ' ' }, { id: 'missing', tag: 'new' }, { id: 'b', tag: 'new' }]) {
    act(() => result.current.setNewTagInput(draft));
    act(() => result.current.handleAddTag(draft.id === 'missing' ? 'missing' : 'a'));
    expect(result.current.newTagInput).toEqual(draft);
  }
  expect(updateTags).not.toHaveBeenCalled();
});

it('removes only the requested tag from the requested row and ignores absent rows', () => {
  tools.setState({ savedKeywords: [keyword('a', { tags: ['priority', 'keep', 'priority'] })] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.handleRemoveTag('missing', 'priority'));
  expect(updateTags).not.toHaveBeenCalled();
  act(() => result.current.handleRemoveTag('a', 'priority'));
  expect(updateTags).toHaveBeenCalledExactlyOnceWith('a', ['keep']);
});
