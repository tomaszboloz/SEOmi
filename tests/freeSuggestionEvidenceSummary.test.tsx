import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { SuggestionEvidenceSummary } from '@/components/KeywordResearch/freeSuggestions/SuggestionEvidenceSummary';

const report = { status: 'observed' as const, hasRun: true, runId: 'run-1', pagesConsidered: 2, pagesOmitted: 0, suggestionsConsidered: 1, suggestionsOmitted: 0, matchesConsidered: 1, matchesOmitted: 0, truncated: false, partialReasons: [], language: 'en', items: [{ suggestion: 'seo audit', intent: { label: 'Informational' as const, confidence: 'uncertain' as const, cues: ['how'] }, pages: [{ url: 'https://example.test/a', title: 'SEO audit', scopes: ['title' as const], matchedTerms: ['seo', 'audit'] }] }] };

describe('SuggestionEvidenceSummary', () => {
  it('renders observed page evidence and uncertain intent', async () => {
    await i18n.changeLanguage('en');
    render(<SuggestionEvidenceSummary report={report} />);
    expect(screen.getByText('SEO audit')).toBeTruthy();
    expect(screen.getByText(/Informational \(uncertain\)/i)).toBeTruthy();
    expect(screen.getByText(/Run run-1/)).toBeTruthy();
  });

  it('states when a project has no crawl evidence', async () => {
    await i18n.changeLanguage('en');
    render(<SuggestionEvidenceSummary report={{ ...report, hasRun: false, runId: null, status: 'no-evidence', items: [] }} />);
    expect(screen.getByText(/No project crawl evidence/i)).toBeTruthy();
  });

  it('renders partial status, truncated warnings, and scope fallbacks', async () => {
    await i18n.changeLanguage('en');
    const complexReport = {
      status: 'partial' as const,
      hasRun: true,
      runId: 'run-partial',
      pagesConsidered: 5,
      pagesOmitted: 2,
      suggestionsConsidered: 3,
      suggestionsOmitted: 1,
      matchesConsidered: 4,
      matchesOmitted: 2,
      truncated: true,
      partialReasons: ['invalid-run-timestamp' as const],
      language: '',
      items: [
        {
          suggestion: 'no cues query',
          intent: { label: 'Commercial' as const, confidence: 'uncertain' as const, cues: [] },
          pages: [
            { url: 'https://example.test/notitle', title: '', scopes: ['semantic-terms' as const], matchedTerms: ['term'] },
          ],
        },
        {
          suggestion: 'no match query',
          intent: { label: 'Navigational' as const, confidence: 'uncertain' as const, cues: [] },
          pages: [],
        },
      ],
    };
    render(<SuggestionEvidenceSummary report={complexReport} />);
    expect(screen.getByText(/Evidence comes from a partial crawl/i)).toBeTruthy();
    expect(screen.getByText(/Evidence language: und/i)).toBeTruthy();
    expect(screen.getByText(/invalid completion timestamp was ignored/i)).toBeTruthy();
    expect(screen.getByText(/Evidence was bounded: 2 pages/i)).toBeTruthy();
    expect(screen.getByText('https://example.test/notitle')).toBeTruthy();
  });

  it('renders no-evidence message when crawl ran but had no matches', async () => {
    await i18n.changeLanguage('en');
    render(<SuggestionEvidenceSummary report={{ ...report, status: 'no-evidence', items: [] }} />);
    expect(screen.getByText(/No matching title or semantic-term evidence/i)).toBeTruthy();
  });
});
