import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { OffPageSourceResults } from '@/components/Domain/backlinkChecker/OffPageSourceResults';
import { buildOffPageReports } from '@/components/Domain/backlinkChecker/useOffPageReports';
import { sourceEvidence } from './fixtures/offPageSources';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);
it('shows pending sources without inventing retrieval dates, plus every TBVA limitation', () => {
  const reports = buildOffPageReports(null);
  reports.tbva.limitations = ['no-topic-vector', 'invalid-scale', 'no-follow-links', 'source-text-or-authority-missing'];
  render(<OffPageSourceResults sources={[sourceEvidence()]} reports={reports} />);
  expect(screen.getByText('Pending')).toBeTruthy();
  expect(screen.getByText('Fetched at: Not fetched')).toBeTruthy();
  expect(screen.getByText(/Invalid authority scale/)).toBeTruthy();
  expect(screen.getByText('No follow links available for analysis.')).toBeTruthy();
});
it('shows both linked and unlinked real report excerpts without treating neutral mentions as endorsement', () => {
  const reports = buildOffPageReports(null);
  const hit = { sourceUrl: 'https://source.test', offset: 14, excerpt: 'Acme SEO', polarity: 'neutral' as const, stance: 'neutral' as const, linked: true };
  reports.coCitation = { linked: [hit], unlinked: [{ ...hit, offset: 100, linked: false }, { ...hit, offset: 200, linked: false, polarity: 'unclear', stance: 'critical' }], inspected: 3, note: 'ready' };
  render(<OffPageSourceResults sources={[sourceEvidence({ availability: 'too-large', fetchedAt: '2026-10-24T10:00:00Z' })]} reports={reports} />);
  expect(screen.getByText('Body too large')).toBeTruthy();
  expect(screen.getAllByText('Neutral co-occurrence; not endorsement')).toHaveLength(2);
  expect(screen.getByText(/offset 14/)).toBeTruthy();
  expect(screen.getByText(/offset 100/)).toBeTruthy();
  expect(screen.getByText('Critical wording near the brand; not a recommendation')).toBeTruthy();
});
