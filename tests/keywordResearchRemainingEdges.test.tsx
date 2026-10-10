import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeywordResearch } from '@/components/Keywords/KeywordResearch';
import { KeywordPrimaryCard } from '@/components/Keywords/keywordResearch/KeywordPrimaryCard';
import { useKeywordResearchSession } from '@/components/Keywords/keywordResearch/useKeywordResearchSession';
import type { KeywordIdea } from '@/types';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/components/DataForSEO/cost/DataForSeoCostMeter', () => ({ DataForSeoCostMeter: () => null }));
vi.mock('@/components/Keywords/keywordResearch/useKeywordResearchSession', () => ({
  useKeywordResearchSession: vi.fn(),
}));

const t = ((key: string) => key) as never;
const item = (difficulty: number): KeywordIdea => ({
  keyword: 'edge keyword', search_volume: 1000, difficulty, cpc: 1.25,
  competition: 0.4, intent: 'Commercial', trend: [1, 2, 3],
});
const session = (primaryItem?: KeywordIdea) => ({
  t, inputQuery: '', setInputQuery: vi.fn(), selectedCountry: 'PL', setSelectedCountry: vi.fn(),
  selectedLanguage: 'pl', setSelectedLanguage: vi.fn(), intentFilter: 'all', setIntentFilter: vi.fn(),
  savedIds: {}, handleSearch: vi.fn(), handleSave: vi.fn(), filteredResults: primaryItem ? [primaryItem] : [],
  primaryItem, savedKeywords: [], isLoading: false, error: null,
});

describe('keyword research rendering edges', () => {
  beforeEach(() => vi.mocked(useKeywordResearchSession).mockReset());

  it('renders the no-result route without a primary card', () => {
    vi.mocked(useKeywordResearchSession).mockReturnValue(session() as never);
    render(<KeywordResearch />);
    expect(screen.queryByText('keywordResearchUi.primaryKeyword')).toBeNull();
    expect(screen.getByText('keywordResearchUi.relatedOpportunities')).toBeTruthy();
  });

  it('renders a saved primary keyword and exercises difficulty colors', () => {
    const onSave = vi.fn();
    const { rerender } = render(<KeywordPrimaryCard primaryItem={item(10)} isSaved={true} onSave={onSave} t={t} />);
    expect(screen.getByText('keywordResearchUi.saved')).toBeTruthy();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('[style="width: 10%;"]')?.className).toContain('bg-emerald');

    rerender(<KeywordPrimaryCard primaryItem={item(70)} isSaved={false} onSave={onSave} t={t} />);
    expect(screen.getByText('keywordResearchUi.addSaved')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(onSave).toHaveBeenCalledWith(item(70));
    expect(document.querySelector('[style="width: 70%;"]')?.className).toContain('bg-rose');
  });

  it('renders the primary route and derives saved state from stored keywords', () => {
    const primary = item(45);
    vi.mocked(useKeywordResearchSession).mockReturnValue({ ...session(primary), savedKeywords: [{ keyword: primary.keyword }] } as never);
    render(<KeywordResearch />);
    expect(screen.getAllByText('keywordResearchUi.saved')).toHaveLength(2);
    expect(screen.getAllByText('edge keyword')).toHaveLength(2);
  });
});
