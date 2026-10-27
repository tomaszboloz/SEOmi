import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { fetchSource } from '@/services/offPage/sourceTransport';
import { downloadBlob } from '@/services/download';
import type { BacklinkGapReport, BacklinkProfileData } from '@/types';
import { createCrawlPageFixture } from './fixtures/crawl';
import { createSemanticCrawlRunFixture } from './fixtures/semanticCrawlRun';

vi.mock('@/services/offPage/sourceTransport', () => ({ fetchSource: vi.fn() }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));

const gapReport: BacklinkGapReport = {
  target: 'https://example.test', competitors: ['comp1.test', 'comp2.test', 'comp3.test'], include_subdomains: true,
  rows_scanned: 10, total_rows: 2,
  opportunities: [
    { referring_domain: 'ref-high.test', target_backlinks: 0, max_competitor_spam_score: 5,
      competitor_backlinks: [{ domain: 'comp1.test', backlinks: 3, rank: 90 }, { domain: 'comp2.test', backlinks: 1, rank: 80 }] },
    { referring_domain: 'ref-low.test', target_backlinks: 0, max_competitor_spam_score: 10,
      competitor_backlinks: [{ domain: 'comp1.test', backlinks: 1, rank: 40 }] },
  ],
};

const topicText = 'Heat pump heating electricity efficiency baseline overview research with practical data. '.repeat(8);
const makeRun = (projectId: string, title: string, terms: string[]) => createSemanticCrawlRunFixture(`run-${projectId}`, '2026-10-24T10:05:00Z', projectId, [
  createCrawlPageFixture({
    url: 'https://example.test/study', final_url: 'https://example.test/study', title,
    word_count: 700, document_language: 'en', semantic_terms: terms,
    rag_sections: [{ heading: 'Analysis', level: 2, paragraphs: [`${topicText} unique metrics.`], tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 }],
    focus_terms: ['heat pump', 'heating', 'electricity', 'efficiency'].map((term) => ({ term, surface: term, count: 8, weight: 12 })),
  }),
]);

describe('Mounted BacklinkChecker Outreach Flow', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [
        { id: 'project-a', name: 'Project A', rootUrl: 'https://example.test', createdAt: '2026-10-24T00:00:00Z', lastOpenedAt: '2026-10-24T00:00:00Z' },
        { id: 'project-b', name: 'Project B', rootUrl: 'https://example.test', createdAt: '2026-10-24T00:00:00Z', lastOpenedAt: '2026-10-24T00:00:00Z' },
      ],
      activeProjectId: 'project-a',
    });
    useToolsStore.setState({
      crawlRuns: [makeRun('project-a', 'Heat pump study A', ['novelty-pump', 'guide-data'])],
      backlinkGapReport: gapReport, backlinkProfile: null, backlinkProfileHistory: [], isBacklinkLoading: false, backlinkError: null,
      backlinkGapCompetitors: ['comp1.test', 'comp2.test', 'comp3.test'], backlinkGapIncludeSubdomains: true,
      isBacklinkGapLoading: false, backlinkGapError: null, backlinkQuery: 'https://example.test',
    });
    vi.mocked(fetchSource).mockImplementation(async (source) => ({ ...source, availability: 'ok', text: topicText, fetchedAt: '2026-10-24T00:00:00Z' }));
  });

  afterEach(() => vi.clearAllMocks());

  it('renders real TOP3 backlink gap targets, exports CSV, and provides verified draft without auto-send', async () => {
    render(<BacklinkChecker />);
    expect(screen.getByText(/ref-high\.test: priority/)).toBeTruthy();
    const outreachPanel = screen.getByTestId('outreach-panel');
    fireEvent.click(within(outreachPanel).getByRole('button', { name: 'Export CSV' }));
    expect(downloadBlob).toHaveBeenCalledWith('seomi-outreach-targets.csv', expect.any(Blob));

    await waitFor(() => expect(screen.getByTestId('outreach-draft').textContent).toContain('Heat pump study A'));
    expect(screen.getByTestId('outreach-draft').textContent).toContain('Source: Heat pump study A · https://example.test/study');
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /mailto/i })).toBeNull();
    expect(screen.getAllByText(/SEOmi never sends messages/).length).toBeGreaterThanOrEqual(1);
  });

  it('isolates Project A and B with same site/competitors and cancels deferred promises on switch', async () => {
    vi.mocked(fetchSource).mockImplementation(async (source) => ({
      ...source, availability: 'ok', text: topicText, fetchedAt: '2026-10-24T00:00:00Z',
    }));
    const { rerender } = render(<BacklinkChecker />);
    await waitFor(() => expect(screen.getByTestId('outreach-draft').textContent).toContain('Heat pump study A'));

    let resolvePending: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => { resolvePending = resolve; });
    vi.mocked(fetchSource).mockImplementation((source) => (source.sourceUrl.includes('comp1.test')
      ? pendingPromise as any
      : Promise.resolve({ ...source, availability: 'ok', text: topicText, fetchedAt: '2026-10-24T00:00:00Z' })));

    act(() => {
      useProjectStore.setState({ activeProjectId: 'project-b' });
      useToolsStore.setState({
        crawlRuns: [makeRun('project-b', 'Heat pump study B', ['novelty-pump', 'guide-data'])],
        backlinkGapReport: gapReport, backlinkQuery: 'https://example.test',
      });
    });
    rerender(<BacklinkChecker />);

    // Immediate check after rerender synchronously cuts useEffect flash:
    expect(screen.queryByText(/Heat pump study A/)).toBeNull();
    expect(screen.queryByTestId('outreach-draft')).toBeNull();

    await act(async () => {
      resolvePending({ sourceUrl: 'https://comp1.test/', authority: 90, availability: 'ok', text: topicText, fetchedAt: '2026-10-24T00:00:00Z' });
    });
    await waitFor(() => expect(screen.getByTestId('outreach-draft').textContent).toContain('Heat pump study B'));
    expect(screen.queryByText(/Heat pump study A/)).toBeNull();
  });

  it('renders session errors, profile data, and handles missing active project gracefully', () => {
    const dummyProfile: BacklinkProfileData = {
      domain: 'https://example.test', total_backlinks: 10, referring_domains: 5, domain_rank: 45,
      referring_subnets: 2, dofollow_ratio: 0.8, total_anchor_rows: 1, total_backlink_rows: 1,
      anchors: [], backlinks: [],
    };
    useToolsStore.setState({ backlinkError: 'API unreachable', backlinkProfile: dummyProfile });
    useProjectStore.setState({ activeProjectId: null });
    const { rerender } = render(<BacklinkChecker />);
    expect(screen.getByText('API unreachable')).toBeTruthy();
    expect(screen.getByText(/Inbound Equity/i)).toBeTruthy();
    rerender(<BacklinkChecker />);
  });
});
