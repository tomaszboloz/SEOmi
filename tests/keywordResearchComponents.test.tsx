import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getIntentBadge,
  getDifficultyColor,
  intentLabel,
} from '@/components/Keywords/keywordResearch/keywordResearchHelpers';
import { KeywordResearchHeader } from '@/components/Keywords/keywordResearch/KeywordResearchHeader';
import { KeywordPrimaryCard } from '@/components/Keywords/keywordResearch/KeywordPrimaryCard';
import { KeywordIdeasTable } from '@/components/Keywords/keywordResearch/KeywordIdeasTable';
import type { KeywordIdea } from '@/types';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => opts?.keyword ? `${key}:${opts.keyword}` : key) as any;

const sampleItem: KeywordIdea = {
  keyword: 'seo tools',
  search_volume: 12000,
  difficulty: 45,
  cpc: 2.5,
  competition: 0.65,
  intent: 'Commercial',
  trend: [10000, 11000, 12000],
};

describe('KeywordResearch modular architecture', () => {
  it('satisfies physical LOC <= 150 across KeywordResearch and submodules', () => {
    const files = [
      'src/components/Keywords/KeywordResearch.tsx',
      ...codeFiles('src/components/Keywords/keywordResearch'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('provides helpers for badges, difficulty colors, and intent labels', () => {
    expect(getIntentBadge('Commercial')).toContain('text-amber-400');
    expect(getIntentBadge('Transactional')).toContain('text-emerald-400');
    expect(getIntentBadge('Informational')).toContain('text-blue-400');
    expect(getIntentBadge('Navigational')).toContain('text-purple-400');
    expect(getIntentBadge('Unknown')).toContain('text-slate-300');
    expect(getDifficultyColor(20)).toContain('text-emerald-400');
    expect(getDifficultyColor(50)).toContain('text-amber-400');
    expect(getDifficultyColor(80)).toContain('text-rose-400');
    expect(intentLabel('Informational', mockT)).toBe('keywordResearchUi.intent.informational');
    expect(intentLabel('Unknown', mockT)).toBe('keywordResearchUi.intent.unknown');
  });


  it('renders KeywordResearchHeader correctly', () => {
    render(<KeywordResearchHeader t={mockT} />);
    expect(screen.getByText('keywordResearchUi.title')).toBeTruthy();
    expect(screen.getByText('keywordResearchUi.badge')).toBeTruthy();
  });

  it('renders KeywordPrimaryCard and triggers save', () => {
    const onSave = vi.fn();
    render(
      <KeywordPrimaryCard
        primaryItem={sampleItem}
        isSaved={false}
        onSave={onSave}
        t={mockT}
      />,
    );

    expect(screen.getByText('seo tools')).toBeTruthy();
    expect(screen.getByText('12,000')).toBeTruthy();
    expect(screen.getByText('$2.50')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();

    const saveBtn = screen.getByRole('button', { name: /keywordResearchUi.addSaved/i });
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledWith(sampleItem);
  });

  it('renders KeywordIdeasTable and filters by intent', () => {
    const onSave = vi.fn();
    const setIntentFilter = vi.fn();
    render(
      <KeywordIdeasTable
        filteredResults={[sampleItem]}
        intentFilter="all"
        setIntentFilter={setIntentFilter}
        savedIds={{}}
        savedKeywords={[]}
        onSave={onSave}
        t={mockT}
      />,
    );

    expect(screen.getByText('seo tools')).toBeTruthy();
    const commercialBtn = screen.getByRole('button', { name: /keywordResearchUi\.intent\.commercial/i });
    fireEvent.click(commercialBtn);
    expect(setIntentFilter).toHaveBeenCalledWith('Commercial');
  });
});
