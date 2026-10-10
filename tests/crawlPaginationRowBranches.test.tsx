import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { CrawledPaginationLink, CrawledPageSummary } from '@/types';
import { CrawlPaginationRow } from '@/components/Domain/crawlResults/internationalTab/CrawlPaginationRow';
import { createCrawlPageFixture } from './fixtures/crawl';

const base: CrawledPaginationLink = { relation: 'next', target_url: 'https://example.test/?page=2', query_parameter_changes: [], checked_in_run: false };
const show = (link?: CrawledPaginationLink, patch: Partial<CrawledPageSummary> = {}) => render(
  <table><tbody><CrawlPaginationRow page={createCrawlPageFixture(patch)} link={link} t={i18n.t} /></tbody></table>,
);
afterEach(cleanup);

it('shows unavailable counts and an invalid target for a legacy declaration', () => {
  show();
  expect(screen.getAllByText(i18n.t('crawlDeepUi.legacyUnavailable'))).toHaveLength(3);
  expect(screen.getByText(i18n.t('crawlDeepUi.invalidPaginationTarget')).getAttribute('colspan')).toBe('5');
});

it('preserves zero counts and known canonical alignment without a target', () => {
  show(undefined, { pagination_declaration_count: 0, pagination_invalid_declaration_count: 0, pagination_canonical_alignment: 'self' });
  expect(screen.getAllByText('0')).toHaveLength(2);
  expect(screen.getByText('self')).toBeTruthy();
});

it.each([
  [undefined, 'reciprocityUnchecked'], [null, 'reciprocityUnchecked'], [false, 'no'], [true, 'yes'],
] as const)('shows reciprocity %s independently from unchecked transport', (reciprocal_in_run, key) => {
  show({ ...base, reciprocal_in_run });
  expect(screen.getByText(i18n.t(`crawlDeepUi.${key}`))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawlDeepUi.notCheckedThisRun'))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawlDeepUi.noQueryChanges'))).toBeTruthy();
});

it.each([undefined, null, 0])('shows no response for absent/zero measured status %s', (http_status) => {
  show({ ...base, checked_in_run: true, http_status });
  expect(screen.getByText(i18n.t('crawlDeepUi.noResponse'))).toBeTruthy();
});

it('renders actual status, changes and invalid declarations', () => {
  show({ ...base, checked_in_run: true, http_status: 301, reciprocal_in_run: true, query_parameter_changes: ['page:1→2', 'sort:new'] },
    { pagination_declaration_count: 2, pagination_invalid_declaration_count: 1, pagination_canonical_alignment: 'self' });
  expect(screen.getByText(i18n.t('crawl.ui.httpStatus', { status: 301 }))).toBeTruthy();
  expect(screen.getByText('page:1→2 · sort:new')).toBeTruthy();
  expect(screen.getByText('1').className).toContain('text-amber-300');
  expect(screen.getByText(base.target_url)).toBeTruthy();
});
