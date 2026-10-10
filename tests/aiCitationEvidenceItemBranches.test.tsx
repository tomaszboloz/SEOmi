import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { AiCitationEvidence, AiCitationContextMatch } from '@/services/aiCitationEvidence';
import { AiCitationEvidenceItem } from '@/components/AiVisibility/searchPrompts/AiCitationEvidenceItem';
import { createCrawlRunFixture } from './fixtures/crawl';

const run = createCrawlRunFixture();
const evidence: AiCitationEvidence = { citation: 'https://example.com', normalizedUrl: 'https://example.com', matched: true };
const context: AiCitationContextMatch = {
  scope: 'no-content-signal', matchedTerms: [], responseTermCount: 0, sourceTermCount: 0,
  coveragePercent: null, meetsMinimum: false, excerptMatch: false, sentenceMatch: false,
  sentenceOverlapPercent: null, matchedTermEvidence: [],
};
const show = (patch: Partial<AiCitationEvidence> = {}, snapshot = run) => render(
  <AiCitationEvidenceItem cite={evidence.citation} cIdx={0} evidence={{ ...evidence, ...patch }} sourceContextRun={snapshot} t={i18n.t} />,
);
afterEach(cleanup);

it('distinguishes no snapshot, invalid URL, absent citation and present evidence', () => {
  const view = render(<AiCitationEvidenceItem cite="bad" cIdx={0} evidence={undefined} sourceContextRun={null} t={i18n.t} />);
  expect(screen.getByText(i18n.t('aiVisibility.search.statusNoSnapshot'))).toBeTruthy();
  view.rerender(<AiCitationEvidenceItem cite="bad" cIdx={0} evidence={undefined} sourceContextRun={run} t={i18n.t} />);
  expect(screen.getByText(i18n.t('aiVisibility.search.statusInvalidUrl'))).toBeTruthy();
  view.unmount();
  show({ matched: false });
  expect(screen.getByText(i18n.t('aiVisibility.search.statusAbsent'))).toBeTruthy();
});

it.each([
  [{ title: 'Title', final_url: 'https://final.test', url: 'https://request.test' }, 'Title'],
  [{ title: '', final_url: 'https://final.test', url: 'https://request.test' }, 'https://final.test'],
  [{ title: '', final_url: '', url: 'https://request.test' }, 'https://request.test'],
] as const)('uses the best saved source label', (labelFields, label) => {
  show({ page: { ...labelFields, http_status: 200, indexability_status: 'indexable' }, matchKind: 'final_url' });
  expect(screen.getByText(i18n.t('aiVisibility.search.matchDetail', { label, kind: 'final_url' }))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.search.statusPresent', { status: 200, indexability: 'indexable' }))).toBeTruthy();
});

it('renders missing page facts as unknown and omits an empty match label', () => {
  show();
  expect(screen.getByText(i18n.t('aiVisibility.search.statusPresent', { status: '—', indexability: i18n.t('aiVisibility.search.indexabilityUnknown') }))).toBeTruthy();
  expect(screen.getByRole('listitem').children).toHaveLength(1);
});

it.each([
  ['sentence-match', 'sentenceContext'], ['excerpt', 'excerptContext'], ['semantic-terms', 'semanticContext'],
  ['title', 'titleContext'], ['no-content-signal', 'noSignalContext'],
] as const)('renders local context scope %s and below-threshold evidence', (scope, key) => {
  show({ context: { ...context, scope } });
  expect(screen.getByText((text) => text.includes(i18n.t('aiVisibility.search.belowThreshold')) && text.includes(i18n.t(`aiVisibility.search.${key}`, { percent: 0 })))).toBeTruthy();
  expect(screen.queryByText(i18n.t('aiVisibility.search.observableSignal'))).toBeNull();
});

it.each(['title', 'semantic-excerpt'] as const)('renders explicit %s spans, term positions and source text', (source) => {
  show({ context: { ...context, scope: 'sentence-match', meetsMinimum: true, matchedTerms: ['audit', 'crawl'], sourceTermCount: 2,
    sentenceOverlapPercent: 80, responseSpan: { text: 'answer', start: 2, end: 8, source: 'response' },
    sourceSpan: { text: 'source', start: 1, end: 7, source },
    matchedTermEvidence: [{ term: 'audit', response: { start: 2, end: 7 } }, { term: 'crawl' }],
    matchedResponseSentence: 'Saved answer.', matchedExcerpt: 'Saved excerpt.',
  } });
  expect(screen.getByText((text) => text.includes('audit, crawl') && text.includes(i18n.t('aiVisibility.search.observableSignal')))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.search.termPositions', { terms: 'audit @2–7, crawl' }))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.search.responseSentence', { text: 'Saved answer.' }))).toBeTruthy();
  expect(screen.getByText(i18n.t('aiVisibility.search.localExcerpt', { text: 'Saved excerpt.' }))).toBeTruthy();
  const sourceKey = source === 'title' ? 'sourceRangeTitle' : 'sourceRangeExcerpt';
  expect(screen.getByText(i18n.t('aiVisibility.search.evidenceRange', { range: `${i18n.t('aiVisibility.search.responseRange', { start: 2, end: 8 })} · ${i18n.t(`aiVisibility.search.${sourceKey}`, { start: 1, end: 7 })}` }))).toBeTruthy();
});

it('renders a bare match label when no match kind is saved', () => {
  show({ page: { url: 'https://request.test', final_url: '', http_status: 200, indexability_status: '', title: '' } });
  expect(screen.getByText('https://request.test')).toBeTruthy();
});
