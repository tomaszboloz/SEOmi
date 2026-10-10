import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedKeywords } from '@/components/Keywords/SavedKeywords';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import i18n from '@/i18n';

vi.mock('@/components/Keywords/savedKeywords/useSavedKeywordsSession', () => ({ useSavedKeywordsSession: vi.fn() }));

describe('direct saved-keyword workspace navigation', () => {
  it('routes both discovery entry points to keyword research and keeps empty export disabled', () => {
    const setActiveTab = vi.fn();
    const exportCSV = vi.fn();
    vi.mocked(useSavedKeywordsSession).mockReturnValue({
      t: i18n.t, savedKeywords: [], searchFilter: '', setSearchFilter: vi.fn(),
      activeTagFilter: null, setActiveTagFilter: vi.fn(), newTagInput: null,
      setNewTagInput: vi.fn(), allTags: [], totalKeywords: 0, totalVolume: 0,
      avgDifficulty: 0, estMonthlyValue: 0, filteredList: [], exportCSV,
      handleAddTag: vi.fn(), handleRemoveTag: vi.fn(), removeSavedKeyword: vi.fn(), setActiveTab,
    });
    render(<SavedKeywords />);
    for (const key of ['findMore', 'exploreNow']) {
      fireEvent.click(screen.getByRole('button', { name: i18n.t(`savedKeywordsUi.${key}`) }));
      expect(setActiveTab).toHaveBeenLastCalledWith('keyword-research');
    }
    expect(setActiveTab).toHaveBeenCalledTimes(2);
    const exportButton = screen.getByRole('button', { name: i18n.t('savedKeywordsUi.exportCsv') });
    expect((exportButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(exportButton);
    expect(exportCSV).not.toHaveBeenCalled();
  });
});
