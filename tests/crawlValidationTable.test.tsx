import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlValidationTable } from '@/components/Domain/crawlResults/CrawlValidationTable';
import type { ValidationPageMatch } from '@/components/Domain/crawlResults/crawlValidationFilter';

beforeEach(async () => { await i18n.changeLanguage('en'); });

const match = (page: Record<string, unknown>, findings: Array<Record<string, unknown>> = []) =>
  ({ page: { url: 'https://a.test/', ...page }, findings, pageMatches: true }) as unknown as ValidationPageMatch;

it('shows declared and decoded charsets or explains why they are missing', () => {
  render(<CrawlValidationTable t={i18n.t} validationPages={[
    match({ url: 'https://a.test/ok', charset: 'utf-8', detected_charset: 'UTF-8' }),
    match({ url: 'https://a.test/cut', body_truncated: true }),
    match({ url: 'https://a.test/none' }),
  ]} />);
  const rows = screen.getAllByRole('row').slice(1);
  expect(within(rows[0]).getByText('utf-8')).toBeTruthy();
  expect(within(rows[0]).getByText('UTF-8')).toBeTruthy();
  expect(within(rows[1]).getByText(i18n.t('crawlDeepUi.bodyTruncated'))).toBeTruthy();
  expect(within(rows[2]).getByText(i18n.t('crawlDeepUi.noData'))).toBeTruthy();
  expect(within(rows[2]).getByText(i18n.t('crawlDeepUi.notDeclared'))).toBeTruthy();
});

it('renders each finding with severity, position and raw evidence', () => {
  render(<CrawlValidationTable t={i18n.t} validationPages={[match({ html_validation_truncated: true }, [
    { code: 'duplicate-id', severity: 'Error', message: 'Duplicate id "a"', element: 'div', attribute: 'id', value: 'a', line: 12, column: 4 },
  ])]} />);
  expect(screen.getByText(new RegExp(`${i18n.t('crawlDeepUi.line')} 12:4`))).toBeTruthy();
  expect(screen.getByText('Duplicate id "a"')).toBeTruthy();
  expect(screen.getByText(new RegExp(i18n.t('crawlDeepUi.limitedResult')))).toBeTruthy();
});
