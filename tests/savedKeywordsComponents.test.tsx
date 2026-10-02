import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedKeywordsHeader } from '@/components/Keywords/savedKeywords/SavedKeywordsHeader';
import { SavedKeywordsMetricsCards } from '@/components/Keywords/savedKeywords/SavedKeywordsMetricsCards';
import { SavedKeywordsFilterBar } from '@/components/Keywords/savedKeywords/SavedKeywordsFilterBar';
import { SavedKeywordsTable } from '@/components/Keywords/savedKeywords/SavedKeywordsTable';
import type { SavedKeywordItem } from '@/types';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.count !== 'undefined') return `${key}:${opts.count}`;
  return key;
}) as any;

const sampleItem: SavedKeywordItem = {
  id: 'sk-1',
  keyword: 'seo analysis',
  search_volume: 5400,
  difficulty: 42,
  cpc: 1.8,
  intent: 'Commercial',
  tags: ['priority', 'audit'],
  addedAt: '2026-10-01',
};

describe('SavedKeywords modular architecture', () => {
  it('satisfies physical LOC <= 150 across SavedKeywords and submodules', () => {
    const files = [
      'src/components/Keywords/SavedKeywords.tsx',
      ...codeFiles('src/components/Keywords/savedKeywords'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders SavedKeywordsHeader and triggers findMore and exportCsv', () => {
    const onFindMore = vi.fn();
    const onExportCsv = vi.fn();
    render(
      <SavedKeywordsHeader
        hasSavedKeywords={true}
        onFindMore={onFindMore}
        onExportCsv={onExportCsv}
        t={mockT}
      />,
    );

    expect(screen.getByText('savedKeywordsUi.title')).toBeTruthy();
    const findBtn = screen.getByRole('button', { name: /savedKeywordsUi.findMore/i });
    fireEvent.click(findBtn);
    expect(onFindMore).toHaveBeenCalled();

    const exportBtn = screen.getByRole('button', { name: /savedKeywordsUi.exportCsv/i });
    fireEvent.click(exportBtn);
    expect(onExportCsv).toHaveBeenCalled();
  });

  it('renders SavedKeywordsMetricsCards with calculations', () => {
    render(
      <SavedKeywordsMetricsCards
        totalKeywords={1}
        totalVolume={5400}
        avgDifficulty={42}
        estMonthlyValue={486}
        t={mockT}
      />,
    );

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('5,400')).toBeTruthy();
    expect(screen.getByText('42 / 100')).toBeTruthy();
    expect(screen.getByText('$486')).toBeTruthy();
  });

  it('renders SavedKeywordsFilterBar and interacts with tags', () => {
    const setSearchFilter = vi.fn();
    const setActiveTagFilter = vi.fn();
    render(
      <SavedKeywordsFilterBar
        searchFilter=""
        setSearchFilter={setSearchFilter}
        activeTagFilter={null}
        setActiveTagFilter={setActiveTagFilter}
        allTags={['priority', 'audit']}
        totalSavedKeywords={1}
        t={mockT}
      />,
    );

    const tagBtn = screen.getByRole('button', { name: 'priority' });
    fireEvent.click(tagBtn);
    expect(setActiveTagFilter).toHaveBeenCalledWith('priority');
  });

  it('renders SavedKeywordsTable with empty and filled states', () => {
    const onExploreNow = vi.fn();
    const { rerender } = render(
      <SavedKeywordsTable
        filteredList={[]}
        newTagInput={null}
        setNewTagInput={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onDeleteKeyword={vi.fn()}
        onExploreNow={onExploreNow}
        t={mockT}
      />,
    );

    expect(screen.getByText('savedKeywordsUi.noMatches')).toBeTruthy();

    rerender(
      <SavedKeywordsTable
        filteredList={[sampleItem]}
        newTagInput={null}
        setNewTagInput={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onDeleteKeyword={vi.fn()}
        onExploreNow={onExploreNow}
        t={mockT}
      />,
    );

    expect(screen.getByText('seo analysis')).toBeTruthy();
    expect(screen.getByText('5,400')).toBeTruthy();
    expect(screen.getByText('$1.80')).toBeTruthy();
  });
});
