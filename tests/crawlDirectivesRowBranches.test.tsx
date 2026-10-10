import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { CrawledPageSummary } from '@/types';
import { CrawlDirectivesRow } from '@/components/Domain/crawlResults/directivesTab/CrawlDirectivesRow';
import { createCrawlPageFixture } from './fixtures/crawl';

const show = (patch: Partial<CrawledPageSummary> = {}, mode?: string) => render(
  <table><tbody><CrawlDirectivesRow page={createCrawlPageFixture(patch)} crawlMode={mode} t={i18n.t} /></tbody></table>,
);
afterEach(cleanup);

it('keeps absent transport and old canonical data unavailable', () => {
  show({ http_status: 0 });
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getAllByText(i18n.t('crawlDeepUi.legacyNoData'))).toHaveLength(2);
  expect(screen.getByText(i18n.t('crawl.ui.noCanonical'))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawl.ui.noDataOlderRun'))).toBeTruthy();
});

it('renders old canonical URL without inventing target status', () => {
  show({ http_status: 0, request_error_kind: 'timeout', canonical: 'https://canonical.test' });
  expect(screen.getByText('timeout')).toBeTruthy();
  expect(screen.getByText((text) => text.includes('https://canonical.test') && text.includes(i18n.t('crawlDeepUi.targetStatusUnavailable')))).toBeTruthy();
});

it.each([undefined, null, 0])('shows no response for checked canonical target status %s', (http_status) => {
  show({ canonical_relation: 'self', canonical_targets: [{ url: 'https://canonical.test', relation: 'self', checked_in_run: true, http_status }] });
  expect(screen.getByText(`· ${i18n.t('crawlDeepUi.noResponse')}`)).toBeTruthy();
});

it('renders measured and unchecked canonical targets and conflict', () => {
  show({ canonical_relation: 'different', canonical_declaration_count: 2, canonical_robots_conflict: true, meta_robots: 'noindex', x_robots_tag: 'nofollow',
    canonical_targets: [
      { url: 'https://one.test', relation: 'different', checked_in_run: true, http_status: 404 },
      { url: 'https://two.test', relation: 'different', checked_in_run: false },
    ], robots_decision: { indexability: 'noindex', link_following: 'nofollow', directives: ['noindex'], sources: ['meta'], response_headers_available: true } });
  expect(screen.getByText('different · 2')).toBeTruthy();
  expect(screen.getByText(`· ${i18n.t('crawl.ui.httpStatus', { status: 404 })}`)).toBeTruthy();
  expect(screen.getByText(`· ${i18n.t('crawlDeepUi.notCheckedThisRun')}`)).toBeTruthy();
  expect(screen.getByText(`${i18n.t('crawlDeepUi.yes')} · ${i18n.t('crawlDeepUi.canonicalNoindex')}`)).toBeTruthy();
  expect(screen.getByText((text) => text.includes('meta') && text.includes(i18n.t('crawlDeepUi.headersAvailable')))).toBeTruthy();
});

it('distinguishes rendered header absence and default robots decisions', () => {
  show({ canonical_robots_conflict: false, x_robots_tag: 'nofollow', robots_decision: { indexability: 'index', link_following: 'follow', response_headers_available: false } }, 'browser-rendered');
  const cells = screen.getAllByRole('cell');
  expect(within(cells[7]).getByText(i18n.t('crawlDeepUi.legacyUnavailable'))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawlDeepUi.notDetected'))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawlDeepUi.defaults'))).toBeTruthy();
  expect(screen.getByText((text) => text.includes(i18n.t('crawlDeepUi.headersUnavailable')))).toBeTruthy();
});
