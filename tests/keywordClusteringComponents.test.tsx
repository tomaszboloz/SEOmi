import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeywordClusteringHeader } from '@/components/Keywords/keywordClustering/KeywordClusteringHeader';
import { KeywordClusteringResults } from '@/components/Keywords/keywordClustering/KeywordClusteringResults';
import { KeywordClusteringPickers } from '@/components/Keywords/keywordClustering/KeywordClusteringPickers';
import { DEFAULT_SESSION, parseKeywords } from '@/components/Keywords/keywordClustering/keywordClusteringTypes';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('KeywordClustering modular architecture', () => {
  it('satisfies physical LOC <= 150 across keywordClustering files', () => {
    const files = [
      'src/components/Keywords/KeywordClustering.tsx',
      ...codeFiles('src/components/Keywords/keywordClustering'),
    ];
    expect(files.length).toBe(9);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('correctly parses unique normalized keywords', () => {
    const input = 'SEO audit\n  seo audit  \nkeyword research\n\nRank tracking';
    const parsed = parseKeywords(input);
    expect(parsed).toEqual(['SEO audit', 'keyword research', 'Rank tracking']);
  });

  it('renders KeywordClusteringHeader', () => {
    render(<KeywordClusteringHeader t={mockT} />);
    expect(screen.getByText('keywordClusteringUi.title')).toBeTruthy();
    expect(screen.getByText('keywordClusteringUi.badge')).toBeTruthy();
  });

  it('renders KeywordClusteringResults with clusters and unclustered items', () => {
    const result = {
      analyzedAt: '2026-10-01T12:00:00.000Z',
      minSharedUrls: 3,
      snapshots: [],
      clusters: [
        {
          id: 'cluster-1',
          keywords: ['seo audit', 'site audit'],
          pairOverlaps: [
            {
              keywordA: 'seo audit',
              keywordB: 'site audit',
              sharedUrls: ['https://example.com/guide'],
            },
          ],
        },
      ],
      unclusteredKeywords: ['technical seo'],
    };

    render(<KeywordClusteringResults result={result as any} t={mockT} />);
    expect(screen.getByText('keywordClusteringUi.resultTitle')).toBeTruthy();
    expect(screen.getByText('seo audit')).toBeTruthy();
    expect(screen.getByText('site audit')).toBeTruthy();
    expect(screen.getByText('technical seo')).toBeTruthy();
  });

  it('renders KeywordClusteringPickers and handles updates', () => {
    const updateSession = vi.fn();
    const changeCountry = vi.fn();

    render(
      <KeywordClusteringPickers
        session={DEFAULT_SESSION}
        keywordsCount={5}
        isRunning={false}
        changeCountry={changeCountry}
        updateSession={updateSession}
        t={mockT}
      />,
    );

    const sharedUrlsInput = screen.getByDisplayValue('3');
    expect(sharedUrlsInput).toBeTruthy();
    fireEvent.change(sharedUrlsInput, { target: { value: '4' } });
    expect(updateSession).toHaveBeenCalledWith({ minSharedUrls: 4, result: null });

    fireEvent.change(sharedUrlsInput, { target: { value: '' } });
    expect(updateSession).toHaveBeenCalledWith({ minSharedUrls: 1, result: null });

    const langInput = screen.getByRole('combobox', { name: 'dataforseo.languageLabel' });
    fireEvent.focus(langInput);
    const options = screen.getAllByRole('option');
    if (options.length > 0) {
      fireEvent.click(options[0]);
      expect(updateSession).toHaveBeenCalled();
    }
  });
});
