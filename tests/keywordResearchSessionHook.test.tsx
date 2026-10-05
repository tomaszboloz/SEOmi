import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeywordResearchSession } from '@/components/Keywords/keywordResearch/useKeywordResearchSession';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { KeywordIdea } from '@/types';
import i18n from '@/i18n';

const fns = {
  setKeywordQuery: vi.fn(), setKeywordCountry: vi.fn(), setKeywordLanguage: vi.fn(),
  searchKeywords: vi.fn(), addSavedKeyword: vi.fn(),
};
const idea = (keyword: string, intent: string): KeywordIdea =>
  ({ keyword, search_volume: 100, difficulty: 20, cpc: 1.5, intent } as KeywordIdea);
const ev = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent & { preventDefault: ReturnType<typeof vi.fn> };

describe('useKeywordResearchSession', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.values(fns).forEach((f) => f.mockReset());
    useProjectStore.setState({ activeProjectId: 'p1' });
    useToolsStore.setState({
      ...fns, keywordQuery: 'seo', keywordCountry: 'PL', keywordLanguage: 'pl',
      keywordResults: [idea('seo audit', 'Informational'), idea('buy seo', 'commercial')],
      savedKeywords: [], isKeywordLoading: false, keywordError: null,
    } as never);
  });

  it('initialises inputs from the store and exposes primary item', () => {
    const { result } = renderHook(() => useKeywordResearchSession());
    expect(result.current.inputQuery).toBe('seo');
    expect(result.current.selectedCountry).toBe('PL');
    expect(result.current.selectedLanguage).toBe('pl');
    expect(result.current.primaryItem?.keyword).toBe('seo audit');
    expect(result.current.intentFilter).toBe('all');
  });

  it('has no primary item without results', () => {
    useToolsStore.setState({ keywordResults: [] } as never);
    expect(renderHook(() => useKeywordResearchSession()).result.current.primaryItem).toBeUndefined();
  });

  it('submits a trimmed search and syncs query, country and language to the store', () => {
    const { result } = renderHook(() => useKeywordResearchSession());
    act(() => {
      result.current.setInputQuery('  new term ');
      result.current.setSelectedCountry('DE');
      result.current.setSelectedLanguage('de');
    });
    const event = ev();
    act(() => result.current.handleSearch(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(fns.setKeywordQuery).toHaveBeenCalledWith('new term');
    expect(fns.setKeywordCountry).toHaveBeenCalledWith('DE');
    expect(fns.setKeywordLanguage).toHaveBeenCalledWith('de');
    expect(fns.searchKeywords).toHaveBeenCalledWith('new term', 'DE', 'de');
  });

  it('ignores blank searches', () => {
    const { result } = renderHook(() => useKeywordResearchSession());
    act(() => result.current.setInputQuery('   '));
    const event = ev();
    act(() => result.current.handleSearch(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(fns.searchKeywords).not.toHaveBeenCalled();
    expect(fns.setKeywordQuery).not.toHaveBeenCalled();
  });

  it('filters results by intent case-insensitively and resets with "all"', () => {
    const { result } = renderHook(() => useKeywordResearchSession());
    act(() => result.current.setIntentFilter('informational'));
    expect(result.current.filteredResults.map((r) => r.keyword)).toEqual(['seo audit']);
    act(() => result.current.setIntentFilter('COMMERCIAL'));
    expect(result.current.filteredResults.map((r) => r.keyword)).toEqual(['buy seo']);
    act(() => result.current.setIntentFilter('transactional'));
    expect(result.current.filteredResults).toEqual([]);
    act(() => result.current.setIntentFilter('all'));
    expect(result.current.filteredResults).toHaveLength(2);
  });

  it('saves a keyword with the research tag and marks it saved', () => {
    const { result } = renderHook(() => useKeywordResearchSession());
    act(() => result.current.handleSave(idea('seo audit', 'Informational')));
    expect(fns.addSavedKeyword).toHaveBeenCalledWith({
      keyword: 'seo audit', search_volume: 100, difficulty: 20, cpc: 1.5,
      intent: 'Informational', tags: [i18n.t('keywordResearchUi.researchTag')],
    });
    expect(result.current.savedIds).toEqual({ 'seo audit': true });
  });

  it('resets local state when the project or store query changes', () => {
    const { result } = renderHook(() => useKeywordResearchSession());
    act(() => {
      result.current.setInputQuery('draft');
      result.current.setIntentFilter('commercial');
    });
    act(() => result.current.handleSave(idea('seo audit', 'Informational')));
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    expect(result.current.inputQuery).toBe('seo');
    expect(result.current.intentFilter).toBe('all');
    expect(result.current.savedIds).toEqual({});
    act(() => useToolsStore.setState({ keywordQuery: 'other', keywordCountry: 'DE' } as never));
    expect(result.current.inputQuery).toBe('other');
    expect(result.current.selectedCountry).toBe('DE');
  });

  it('surfaces loading and error state from the store', () => {
    useToolsStore.setState({ isKeywordLoading: true, keywordError: 'boom' } as never);
    const { result } = renderHook(() => useKeywordResearchSession());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe('boom');
  });
});
