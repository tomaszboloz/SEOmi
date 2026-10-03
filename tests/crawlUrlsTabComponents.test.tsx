import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlUrlsSearchSortBar } from '@/components/Domain/crawlResults/urlsTab/CrawlUrlsSearchSortBar';
import { CrawlUrlsFilterBar } from '@/components/Domain/crawlResults/urlsTab/CrawlUrlsFilterBar';
import { CrawlUrlsPresetBar } from '@/components/Domain/crawlResults/urlsTab/CrawlUrlsPresetBar';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('CrawlUrlsTab modular architecture and subcomponents', () => {
  it('satisfies physical LOC <= 150 across urlsTab files', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlUrlsTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/urlsTab'),
    ];
    expect(files.length).toBe(4);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders CrawlUrlsSearchSortBar and responds to input and button events', () => {
    const setQuery = vi.fn();
    const setSegment = vi.fn();
    const setSort = vi.fn();
    const setDescending = vi.fn();

    render(
      <CrawlUrlsSearchSortBar
        query="test-query"
        setQuery={setQuery}
        segment="all"
        setSegment={setSegment}
        sort="url"
        setSort={setSort}
        descending={true}
        setDescending={setDescending}
        t={mockT}
      />,
    );

    const input = screen.getByPlaceholderText('crawl.ui.searchLinkPlaceholder');
    fireEvent.change(input, { target: { value: 'about' } });
    expect(setQuery).toHaveBeenCalledWith('about');

    const descBtn = screen.getByRole('button');
    fireEvent.click(descBtn);
    expect(setDescending).toHaveBeenCalled();
  });

  it('renders CrawlUrlsFilterBar and toggles filters', () => {
    const setOnlyProblems = vi.fn();
    const setSeverity = vi.fn();
    const setErrorKind = vi.fn();

    render(
      <CrawlUrlsFilterBar
        onlyProblems={false}
        setOnlyProblems={setOnlyProblems}
        severity="all"
        setSeverity={setSeverity}
        activeErrorKind="all"
        setErrorKind={setErrorKind}
        errorKinds={['http', 'network']}
        filteredCount={10}
        totalCount={20}
        t={mockT}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(setOnlyProblems).toHaveBeenCalledWith(true);

    const warningBtn = screen.getByRole('button', { name: 'crawl.ui.severityValues.warning' });
    fireEvent.click(warningBtn);
    expect(setSeverity).toHaveBeenCalledWith('Warning');

    expect(screen.getByText('10 / 20')).toBeDefined();
  });

  it('renders CrawlUrlsPresetBar and interacts with presets', () => {
    const applyFilterPreset = vi.fn();
    const setNewPresetName = vi.fn();
    const saveFilterPreset = vi.fn();
    const persistFilterPresets = vi.fn();
    const setSelectedPresetId = vi.fn();

    render(
      <CrawlUrlsPresetBar
        activeProjectId="p1"
        filterPresets={[{ id: 'preset-1', name: 'My Filter' } as any]}
        selectedPresetId="preset-1"
        applyFilterPreset={applyFilterPreset}
        newPresetName="New Filter"
        setNewPresetName={setNewPresetName}
        saveFilterPreset={saveFilterPreset}
        persistFilterPresets={persistFilterPresets}
        setSelectedPresetId={setSelectedPresetId}
        t={mockT}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: 'crawl.ui.saveFilter' });
    fireEvent.click(saveBtn);
    expect(saveFilterPreset).toHaveBeenCalledTimes(1);

    const removeBtn = screen.getByRole('button', { name: 'crawl.ui.removeFilter' });
    fireEvent.click(removeBtn);
    expect(persistFilterPresets).toHaveBeenCalledWith([]);
    expect(setSelectedPresetId).toHaveBeenCalledWith('');
  });
});
