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
});
