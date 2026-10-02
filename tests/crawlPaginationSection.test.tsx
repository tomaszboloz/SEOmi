import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlPaginationSection } from '@/components/Domain/crawlResults/CrawlPaginationSection';
import type { CrawledPageSummary } from '@/types';

beforeEach(async () => { await i18n.changeLanguage('en'); });
const link = (overrides: Record<string, unknown>) => ({ relation: 'next', target_url: 'https://a.test/page/2', checked_in_run: true, http_status: 200, reciprocal_in_run: true, query_parameter_changes: [], ...overrides });

it('reports each pagination link with its run status, reciprocity and query changes', () => {
  const page = { url: 'https://a.test/page/1', pagination_declaration_count: 2, pagination_invalid_declaration_count: 0, pagination_canonical_alignment: 'self',
    pagination_links: [link({}), link({ relation: 'prev', checked_in_run: false, reciprocal_in_run: null, query_parameter_changes: ['page', 'sort'] })] } as unknown as CrawledPageSummary;
  render(<CrawlPaginationSection paginatedPages={[page]} t={i18n.t} />);
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText(i18n.t('crawl.ui.httpStatus', { status: 200 }))).toBeTruthy();
  expect(within(rows[0]).getByText(i18n.t('crawlDeepUi.yes'))).toBeTruthy();
  expect(within(rows[0]).getByText(i18n.t('crawlDeepUi.noQueryChanges'))).toBeTruthy();
  expect(within(rows[1]).getByText(i18n.t('crawlDeepUi.notCheckedThisRun'))).toBeTruthy();
  expect(within(rows[1]).getByText(i18n.t('crawlDeepUi.reciprocityUnchecked'))).toBeTruthy();
  expect(within(rows[1]).getByText('page · sort')).toBeTruthy();
});

it('keeps pages whose declarations produced no valid target and marks legacy counts unavailable', () => {
  const page = { url: 'https://a.test/broken', pagination_next: '::bad' } as unknown as CrawledPageSummary;
  render(<CrawlPaginationSection paginatedPages={[page]} t={i18n.t} />);
  const row = screen.getAllByRole('row')[1];
  expect(within(row).getByText(i18n.t('crawlDeepUi.invalidPaginationTarget'))).toBeTruthy();
  expect(within(row).getAllByText(i18n.t('crawlDeepUi.legacyUnavailable'))).toHaveLength(3);
});
