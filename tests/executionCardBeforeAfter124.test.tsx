import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionCardDetails } from '@/components/Domain/crawlResults/executive/ExecutionCardDetails';
import i18n from '@/i18n';
import type { ExecutiveAction } from '@/services/actionFeed';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import type { CrawledPageSummary } from '@/types';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));

const section = (heading: string, paragraphs: string[]) => ({ heading, level: 2, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 });
const url = 'https://a.test/coffee';
const crawled = { url, document_language: 'en', rag_sections: [section('Benefits and effects', ['It makes the day better. More text.'])] } as unknown as CrawledPageSummary;
const page = { url, type: 'article', weight: 1, trs: 40, offTopicKeywords: [] } as unknown as PageFocus;
const report = { score: 60, pages: [page], model: { language: 'en' }, coreTopic: { label: 'coffee', terms: [{ term: 'coffee', weight: 2, coveragePct: 80 }] } } as unknown as SiteFocusReport;
const focus = { report, pages: [crawled] };
const action = (patch: Partial<ExecutiveAction> = {}): ExecutiveAction => ({
  id: 'a1', type: 'sfs:add-terms', source: 'sfs', urls: [url], evidence: [{ source: 'sfs', code: 'add-terms', items: ['coffee'] }],
  effort: null, moduleDelta: null, hssDelta: null, conflicts: [], dependsOn: [], blocked: false, drillTab: 'focus', ...patch,
});
const open = () => fireEvent.click(screen.getByText(i18n.t('executive.card.title')));

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); });

describe('Execution Card shows the Before/After paragraph (#124 via #127)', () => {
  it('renders the surgical rewrite for a single-URL SFS action', () => {
    render(<ExecutionCardDetails action={action()} focus={focus} onOpen={vi.fn()} />);
    open();
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy After HTML' })).toBeTruthy();
  });

  it('stays out for removals, other sources, several URLs and missing data', () => {
    const cases: Array<[ExecutiveAction, typeof focus | null]> = [
      [action({ type: 'sfs:remove-offtopic' }), focus],
      [action({ source: 'tas', type: 'tas:x' }), focus],
      [action({ urls: [url, `${url}2`] }), focus],
      [action(), null],
      [action({ urls: ['https://a.test/other'] }), focus],
      [action(), { report, pages: [] }],
    ];
    for (const [item, data] of cases) {
      const { unmount } = render(<ExecutionCardDetails action={item} focus={data} onOpen={vi.fn()} />);
      open();
      expect(screen.queryByText('Before')).toBeNull();
      unmount();
    }
  });
});

describe('Executive tab passes the Site Focus report to cards (#124)', () => {
  it('renders without pages and with a real crawl', async () => {
    const { CrawlExecutiveTab } = await import('@/components/Domain/crawlResults/executive/CrawlExecutiveTab');
    const { createCrawlResultFixture, createCrawlRunFixture } = await import('./fixtures/crawl');
    const empty = render(<CrawlExecutiveTab pages={[]} startUrl="https://a.test/" projectId="p1" onOpenTab={vi.fn()} />);
    expect(screen.getByText('Executive dashboard')).toBeTruthy();
    empty.unmount();
    const result = createCrawlResultFixture();
    render(<CrawlExecutiveTab pages={result.pages} startUrl={result.start_url} run={createCrawlRunFixture({ result })} projectId="p1" onOpenTab={vi.fn()} />);
    expect(screen.getByText('Executive dashboard')).toBeTruthy();
  });
});
