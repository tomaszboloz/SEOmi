import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlStructuredTab } from '@/components/Domain/crawlResults/CrawlStructuredTab';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import type { CrawledPageSummary } from '@/types';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import i18n from '@/i18n';

type Session = ReturnType<typeof useCrawlResultsSession>;
const session = (pages: CrawledPageSummary[]) => ({ result: createCrawlResultFixture({ pages }), t: i18n.t } as Session);
const label = (key: string) => i18n.t(`crawlDeepUi.${key}`);

describe('direct crawl structured-data display contracts', () => {
  it('shows no observations for empty and clean pages', () => {
    const view = render(<CrawlStructuredTab session={session([])} />);
    expect(screen.getByText(label('noStructuredData'))).toBeTruthy();
    view.rerender(<CrawlStructuredTab session={session([createCrawlPageFixture()])} />);
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('lists measured types and syntax errors while excluding pages with no evidence', () => {
    render(<CrawlStructuredTab session={session([
      createCrawlPageFixture({ url: 'https://site.test/types', schema_types: ['Article', 'Organization'] }),
      createCrawlPageFixture({ url: 'https://site.test/syntax', schema_syntax_errors: 2 }),
      createCrawlPageFixture({ url: 'https://site.test/none' }),
    ])} />);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Article, Organization')).toBeTruthy();
    expect(screen.getByText(label('notDetected'))).toBeTruthy();
    expect(screen.getByText('2').className).toContain('text-rose-300');
    expect(screen.getByText('0').className).toContain('text-slate-400');
    expect(screen.getAllByText(label('noLocalFindings'))).toHaveLength(2);
    expect(screen.queryByText('https://site.test/none')).toBeNull();
  });
  it('preserves raw evidence, localizes severity and discloses truncated observations', () => {
    const findings: NonNullable<CrawledPageSummary['schema_validation_findings']> = [
      { format: 'jsonld', declaration_index: 1, finding: { code: 'missing-name', severity: 'error', message: 'Raw error', path: '$.name', recommendation: 'Raw recommendation' } },
      { format: 'microdata', declaration_index: 2, finding: { code: 'empty-type', severity: 'warning', message: 'Raw warning' } },
      { format: 'rdfa', declaration_index: 3, finding: { code: 'unsupported', severity: 'info', message: 'Raw info' } },
    ];
    const view = render(<CrawlStructuredTab session={session([
      createCrawlPageFixture({ schema_validation_findings: findings, schema_validation_truncated: true }),
    ])} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].className).toContain('border-rose-500/20');
    expect(items[1].className).toContain('border-amber-500/20');
    expect(items[2].className).toContain('border-sky-500/20');
    expect(within(items[0]).getByText('$.name')).toBeTruthy();
    expect(within(items[0]).getByText('Raw recommendation')).toBeTruthy();
    expect(within(items[1]).queryByText('$.name')).toBeNull();
    expect(screen.getByText(label('validationLimitNote'))).toBeTruthy();
    expect(view.container.querySelector('summary')?.textContent).toContain(label('partial'));
    for (const raw of ['Raw error', 'Raw warning', 'Raw info']) expect(screen.getByText(raw)).toBeTruthy();
    view.rerender(<CrawlStructuredTab session={session([
      createCrawlPageFixture({ schema_types: ['Article'], schema_validation_findings: findings }),
    ])} />);
    expect(screen.queryByText(label('validationLimitNote'))).toBeNull();
    expect(view.container.querySelector('summary')?.textContent).not.toContain(label('partial'));
  });
});
