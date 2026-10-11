import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { CrawlIssuesTab } from '@/components/Domain/crawlResults/CrawlIssuesTab';
import { CrawlPageTableHeader } from '@/components/Domain/crawlResults/pageTable/CrawlPageTableHeader';
import { ComparisonChangesList } from '@/components/Domain/crawlResults/visualisationsTab/ComparisonChangesList';
import { buildCustomSearchRows } from '@/components/Domain/crawlResults/customSearch/customSearchRows';
import { CrawlCustomSearchEditor } from '@/components/Domain/siteAudit/CrawlCustomSearchEditor';
import { CrawlStartControls } from '@/components/Domain/siteAudit/CrawlStartControls';
import { EmbeddingClusteringPanel } from '@/components/Keywords/embeddingClustering/EmbeddingClusteringPanel';
import { saveImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { CrawledPageSummary } from '@/types';
import i18n from '@/i18n';
import { createCrawlPageFixture } from './fixtures/crawl';
import { makeSession, projects, text, tools } from './fixtures/crawlControlPanelsContracts';

const t = ((key: string) => key) as unknown as TFunction;

beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'shard3-panel' }); useToolsStore.setState({ crawlRuns: [], crawlResult: null, isCrawling: false, isCrawlPaused: false }); });
afterEach(() => { cleanup(); useToolsStore.setState(tools); useProjectStore.setState(projects); vi.restoreAllMocks(); });

describe('CrawlIssuesTab', () => {
  const sessionFor = (issues: Array<{ severity: string; message: string }>) => ({
    t, result: { pages: [createCrawlPageFixture({ url: 'https://a.test/', issues: issues as CrawledPageSummary['issues'] })] },
  }) as unknown as Parameters<typeof CrawlIssuesTab>[0]['session'];

  it('colours info issues neutrally and shows the empty state when there are none', () => {
    const { container, rerender } = render(<CrawlIssuesTab session={sessionFor([{ severity: 'Info', message: 'FYI' }])} />);
    expect(container.querySelector('td.text-slate-400')).not.toBeNull();
    expect(container.querySelector('td.text-rose-300')).toBeNull();
    rerender(<CrawlIssuesTab session={sessionFor([])} />);
    expect(screen.getByText('crawl.ui.noIssues')).toBeTruthy();
  });
});

describe('CrawlPageTableHeader', () => {
  it('labels the timing column Navigation for browser-rendered crawls', () => {
    render(<table><CrawlPageTableHeader sort="url" descending={false} setSort={vi.fn()} setDescending={vi.fn()} crawlMode="browser-rendered" t={t} /></table>);
    expect(screen.getByText('crawl.ui.navigation')).toBeTruthy();
    expect(screen.queryByText('crawl.ui.httpTime')).toBeNull();
  });
});

describe('ComparisonChangesList', () => {
  it('shows the matched URL only when it differs from the compared one', () => {
    render(<ComparisonChangesList t={t} comparison={{
      added: [{ kind: 'added', url: 'https://a.test/x', fields: [], matchedUrl: 'https://b.test/x' }],
      removed: [{ kind: 'removed', url: 'https://a.test/same', fields: [], matchedUrl: 'https://a.test/same' }],
      changed: [{ kind: 'changed', url: 'https://a.test/plain', fields: [] }],
    }} />);
    expect(screen.getByText(/https:\/\/a\.test\/x ↔ https:\/\/b\.test\/x/)).toBeTruthy();
    expect(screen.queryByText(/same ↔/)).toBeNull();
    expect(screen.queryByText(/plain ↔/)).toBeNull();
  });
});

describe('buildCustomSearchRows', () => {
  it('flags bounded extractions as truncated', () => {
    const search = { id: 's1', name: 'S', selectorType: 'css', query: 'a', resultType: 'text' } as never;
    const page = createCrawlPageFixture({ url: 'https://a.test/', custom_search_results: [{ id: 's1', values: ['one', 'two'], truncated: true }] } as never);
    const rows = buildCustomSearchRows([page], [search], (key) => key);
    expect(rows.map((row) => row.status)).toEqual(['crawl.customSearch.bounded', 'crawl.customSearch.bounded']);
    expect(rows.map((row) => row.match)).toEqual(['1', '2']);
  });
});

describe('CrawlCustomSearchEditor', () => {
  it('keeps the result type when switching between non-regex selectors and tolerates a missing attribute', () => {
    const session = makeSession({
      customSearches: [{ id: 'a', name: 'First', selectorType: 'css', query: 'a', resultType: 'attribute' }],
      updateCustomSearch: vi.fn(), setCrawlConfig: vi.fn(), addCustomSearch: vi.fn(),
    });
    render(<CrawlCustomSearchEditor session={session} />);
    expect((screen.getByLabelText(`${text('crawl.customSearch.attribute')} First`) as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText(`${text('crawl.customSearch.selectorType')} First`), { target: { value: 'xpath' } });
    expect(session.updateCustomSearch).toHaveBeenCalledWith('a', { selectorType: 'xpath' });
  });
});

describe('CrawlStartControls', () => {
  it('defaults the render mode to HTTP when the config has none', () => {
    const base = makeSession({ desktopAvailable: true });
    render(<CrawlStartControls session={{ ...base, crawlConfig: { ...base.crawlConfig, crawlMode: undefined } }} />);
    expect((screen.getByLabelText(text('siteAudit.renderModeAria')) as HTMLSelectElement).value).toBe('http');
  });
});

describe('EmbeddingClusteringPanel keyword limit', () => {
  it('applies the lower hybrid limit once a SERP import is present', async () => {
    await i18n.changeLanguage('en');
    const keywords = Array.from({ length: 201 }, (_, index) => `keyword ${index}`);
    const { unmount } = render(<EmbeddingClusteringPanel projectId="shard3-panel" keywords={keywords} />);
    expect(screen.queryByText(i18n.t('embeddingClusteringUi.tooMany', { max: 200 }))).toBeNull();
    unmount();
    saveImportedSerp('shard3-panel', 'keyword,rank,url\nrower,1,https://example.com/', 'csv', '2026-10-06T10:00:00Z');
    render(<EmbeddingClusteringPanel projectId="shard3-panel" keywords={keywords} />);
    expect(within(document.body).getByText(i18n.t('embeddingClusteringUi.tooMany', { max: 200 }))).toBeTruthy();
  });
});
