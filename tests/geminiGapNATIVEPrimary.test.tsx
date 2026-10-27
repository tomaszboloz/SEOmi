import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SearchConsoleTables } from '@/components/AgentWorkflows/searchConsole/Tables';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { GapBriefPanel } from '@/components/Domain/crawlResults/authority/GapBriefPanel';
import { useAuthStore } from '@/stores/authStore';
import { CrawlOverviewTab } from '@/components/Domain/crawlResults/CrawlOverviewTab';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';

vi.mock('@/components/AgentWorkflows/searchConsole/PagedTable', () => ({
  PagedTable: ({ paged }: { paged: { toggleSort: (key: string) => void; rows: Array<{ page?: string; query?: string; position: number }> } }) => (
    <div>
      <button data-testid="sort-position-btn" onClick={() => paged.toggleSort('position')}>
        Sort Position
      </button>
      <div data-testid="paged-positions">
        {paged.rows.map((r) => r.position).join(',')}
      </div>
    </div>
  ),
}));

vi.mock('@/components/Domain/crawlResults/CrawlSummaryMetrics', () => ({
  CrawlSummaryMetrics: () => <tr><td>metrics</td></tr>,
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('geminiGapNATIVEPrimary: Tables, GapBriefPanel, CrawlOverviewTab', () => {
  it('covers SearchConsoleTables PAGE_SORT.position (Tables.tsx line 16)', () => {
    const session = {
      t: (key: string) => key,
      gscData: {
        queries: [],
        pages: [
          { page: 'https://example.com/a', clicks: 10, impressions: 100, ctr: 10, position: 5 },
          { page: 'https://example.com/b', clicks: 20, impressions: 200, ctr: 10, position: 2 },
          { page: 'https://example.com/c', clicks: 5, impressions: 50, ctr: 10, position: 8 },
        ],
      },
    } as unknown as SearchConsoleSession;

    render(<SearchConsoleTables session={session} />);
    const sortButtons = screen.getAllByTestId('sort-position-btn');
    fireEvent.click(sortButtons[1]);
    const positions = screen.getAllByTestId('paged-positions');
    expect(positions[1].textContent).toBe('8,5,2');
    fireEvent.click(sortButtons[1]);
    expect(positions[1].textContent).toBe('2,5,8');
  });

  it('covers GapBriefPanel defaultDeps generateText (GapBriefPanel.tsx line 10)', async () => {
    const mockGenerate = vi.fn().mockResolvedValue('## AI Generated Gap Outline\n1. Details');
    useAuthStore.setState({
      isProviderConnected: () => true,
      generateText: mockGenerate,
    } as never);

    const report = {
      score: 80,
      tier: 'strong',
      pillars: { tcr: 0.5, sfs: 0.5 },
      sfs: { raw: 50 },
      subtopics: [],
      coverage: [
        {
          subtopicId: 'sub-1',
          label: 'Missing Piece',
          coverage: 0,
          cluster: 'core',
          pillar: 'general',
          importance: 0.5,
          entitiesMissing: [],
          questionsMissing: [],
          pages: [],
        },
      ],
      gaps: [{ subtopicId: 'sub-1', label: 'Missing Piece', priority: 'high', impact: 85 }],
      cannibalization: [],
      taxonomy: { coreLabel: 'Core Topic', pillars: [], subtopics: [] },
    } as unknown as TopicalAuthorityReport;

    const row = report.coverage[0];
    render(<GapBriefPanel report={report} row={row} />);
    const generateBtn = screen.getByRole('button', { name: i18n.t('authority.brief.generate') });
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalled();
      expect(screen.getByTestId('authority-ai-brief').textContent).toContain('AI Generated Gap Outline');
    });
  });

  it('renders CrawlOverviewTab rejected_urls states with plain stable inputs', () => {
    const sessionWithRejected = {
      result: {
        rejected_urls: [
          { url: 'https://example.com/bad', reason: 'Blocked by robots.txt' },
          { url: 'https://example.com/disallowed', reason: 'HTTP 403 Forbidden' },
        ],
      },
      t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key),
    };
    const viewWithRejected = render(<CrawlOverviewTab session={sessionWithRejected as never} />);
    expect(screen.getByText('siteAudit.rejectedUrls:2')).toBeTruthy();
    expect(screen.getByText(/https:\/\/example\.com\/bad — Blocked by robots\.txt/)).toBeTruthy();
    expect(screen.getByText(/https:\/\/example\.com\/disallowed — HTTP 403 Forbidden/)).toBeTruthy();
    viewWithRejected.unmount();

    const sessionEmpty = {
      result: { rejected_urls: [] },
      t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key),
    };
    const viewEmpty = render(<CrawlOverviewTab session={sessionEmpty as never} />);
    expect(screen.queryByText(/siteAudit\.rejectedUrls/)).toBeNull();
    expect(screen.getByText('crawl.ui.savedHttpValues')).toBeTruthy();
    viewEmpty.unmount();

    const sessionAbsent = {
      result: {},
      t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key),
    };
    render(<CrawlOverviewTab session={sessionAbsent as never} />);
    expect(screen.queryByText(/siteAudit\.rejectedUrls/)).toBeNull();
    expect(screen.getByText('crawl.ui.savedHttpValues')).toBeTruthy();
  });
});
