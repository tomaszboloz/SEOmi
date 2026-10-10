import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { CrawledPageSummary } from '@/types';
import { CrawlInternationalRow } from '@/components/Domain/crawlResults/internationalTab/CrawlInternationalRow';
import { createCrawlPageFixture } from './fixtures/crawl';

const show = (patch: Partial<CrawledPageSummary>) => render(<table><tbody><CrawlInternationalRow page={createCrawlPageFixture(patch)} t={i18n.t} /></tbody></table>);
afterEach(cleanup);

it.each([undefined, null, 0])('does not invent an AMP HTTP response %s', (amp_target_http_status) => {
  show({ amp_url: 'https://amp.test', amp_target_checked_in_run: true, amp_target_http_status });
  expect(screen.getByText(i18n.t('crawlDeepUi.noResponse'))).toBeTruthy();
});

it.each([
  ['canonical-to-source', 'yes'], ['missing-canonical', 'noDirectives'],
  ['self-canonical', 'no'], ['canonical-points-elsewhere', 'no'], [undefined, 'canonicalOutsideRun'],
] as const)('renders actual AMP canonical alignment %s', (amp_target_canonical_alignment, key) => {
  show({ amp_url: 'https://amp.test', amp_target_checked_in_run: true, amp_target_http_status: 200, amp_target_canonical_alignment, document_language: 'pl' });
  expect(within(screen.getAllByRole('cell')[5]).getByText(i18n.t(`crawlDeepUi.${key}`))).toBeTruthy();
  expect(screen.getByText(i18n.t('crawl.ui.httpStatus', { status: 200 }))).toBeTruthy();
  expect(screen.getByText('pl')).toBeTruthy();
});

it('distinguishes absent AMP from an unchecked declared target', () => {
  const view = show({});
  expect(screen.getAllByText(i18n.t('crawlDeepUi.noDirectives'))).toHaveLength(2);
  view.unmount();
  show({ amp_url: 'https://amp.test' });
  expect(screen.getByText(i18n.t('crawlDeepUi.notCheckedThisRun'))).toBeTruthy();
});
