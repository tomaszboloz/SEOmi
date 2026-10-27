import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { TargetPhraseEvidenceSection, TargetPhraseTopTenSection } from '@/components/Results/targetPhraseAudit';
import type { SerpSource } from '@/services/serpImport';
import type { ContentGapTopic, TargetPhraseAudit, TopTenContentGapReport, TopTenPageObservation } from '@/services/targetPhraseAudit';

const source: SerpSource = {
  kind: 'bing-rss', provider: null, sourceUrl: null, countryCode: null, locationCode: null, languageCode: null,
  capturedAt: null, retrievedAt: null, availability: 'blocked', reason: 'provider blocked the feed',
};
const observation = (patch: Partial<TopTenPageObservation> = {}): TopTenPageObservation => ({
  rank: 1, url: 'https://result.example/page', providerTitle: '', providerDescription: '', fetchedAt: null,
  status: null, finalUrl: null, availability: 'unavailable', error: null, ...patch,
});
const topic = (patch: Partial<ContentGapTopic> = {}): ContentGapTopic => ({
  term: 'topic', observedPages: 1, availablePages: 2, share: 0.5, targetOccurrences: null, targetPresent: null,
  status: 'unknown', evidence: [], ...patch,
});
const report = (rows: TopTenPageObservation[], topics: ContentGapTopic[]): TopTenContentGapReport => ({
  phrase: 'SEO', source: 'supplied-serp', retrievedAt: '2026-10-06T10:00:00Z', locationCode: null, languageCode: null,
  rows, availablePages: rows.filter((row) => row.availability === 'available').length, targetAvailable: true, status: 'partial', topics,
});
const phraseAudit: TargetPhraseAudit = {
  phrase: 'SEO', url: '', timestamp: '', intent: 'informational', intentSource: 'provider', completeness: 'partial',
  completenessReasons: ['body-unavailable'], evidence: [
    { field: 'title', occurrences: 1, evidence: ['SEO title'] }, { field: 'h1', occurrences: 0, evidence: [] },
    { field: 'body', occurrences: 0, evidence: [] }, { field: 'anchors', occurrences: 1, evidence: ['SEO link'] },
  ],
};

describe('target phrase audit display contracts', () => {
  it('shows literal evidence, provider intent, partial reasons and empty-field states', () => {
    render(<TargetPhraseEvidenceSection phrase="SEO" phraseAudit={phraseAudit} />);
    expect(screen.getByText(i18n.t('targetPhraseAuditUi.intents.informational'))).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getAllByText(i18n.t('targetPhraseAuditUi.noLiteralEvidence')).length).toBe(2);
    expect(screen.getByText(i18n.t('targetPhraseAuditUi.partialReason'))).toBeTruthy();
  });

  it('reports the empty evidence prompt when no phrase audit is available', () => {
    render(<TargetPhraseEvidenceSection phrase="  " phraseAudit={null} />);
    expect(screen.getByText(i18n.t('targetPhraseAuditUi.enterPhrase'))).toBeTruthy();
  });

  it('renders source fallbacks, all row status variants and topic status variants', () => {
    const rows = [
      observation({ availability: 'available', providerTitle: 'Provider title', status: 200, finalUrl: 'https://result.example/page' }),
      observation({ rank: 2, url: 'https://result.example/redirect', availability: 'error', error: 'timeout', finalUrl: 'https://final.example/page' }),
      observation({ rank: 3, url: 'https://result.example/missing', status: 404, error: 'http-404' }),
    ];
    const topics = [
      topic({ term: 'gap', status: 'gap', targetOccurrences: 0, targetPresent: false, evidence: [{ rank: 1, url: rows[0].url, excerpt: 'gap evidence' }] }),
      topic({ term: 'covered', status: 'covered', targetOccurrences: 2, targetPresent: true }),
      topic({ term: 'unknown', status: 'unknown' }),
    ];
    const onAudit = vi.fn();
    render(<TargetPhraseTopTenSection phrase="SEO" source={source} report={report(rows, topics)} unavailableReason="no-import" canAudit isLoading error="network" onAudit={onAudit} />);
    expect(screen.getAllByText(i18n.t('targetPhraseAuditUi.unknown')).length).toBeGreaterThan(1);
    expect(screen.getByText('provider blocked the feed')).toBeTruthy();
    expect(screen.getByText('Provider title')).toBeTruthy();
    expect(screen.getByText('timeout')).toBeTruthy();
    expect(screen.getByText('gap evidence')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('network');
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button'));
    expect(onAudit).not.toHaveBeenCalled();
  });

  it('renders no-row and no-topic reports and invokes an enabled audit action', () => {
    const onAudit = vi.fn();
    render(<TargetPhraseTopTenSection phrase="SEO" source={null} report={report([], [])} unavailableReason={null} canAudit isLoading={false} error={null} onAudit={onAudit} />);
    expect(screen.getByText(i18n.t('targetPhraseAuditUi.noRows'))).toBeTruthy();
    expect(screen.getByText(i18n.t('targetPhraseAuditUi.noTopics'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('targetPhraseAuditUi.auditTopTen') }));
    expect(onAudit).toHaveBeenCalledTimes(1);
  });

});
