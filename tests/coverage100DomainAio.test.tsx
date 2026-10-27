import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AioHero } from '@/components/Domain/crawlResults/aio/AioHero';
import { AioPagesTable } from '@/components/Domain/crawlResults/aio/AioPagesTable';
import { AioPassageCard } from '@/components/Domain/crawlResults/aio/AioPassageCard';
import { BacklinkOutreachSection } from '@/components/Domain/backlinkChecker/BacklinkOutreachSection';
import { CrawlOverviewTab } from '@/components/Domain/crawlResults/CrawlOverviewTab';

const rewriteMock = vi.hoisted(() => vi.fn());
const downloadMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/aioReadiness', async (original) => ({ ...(await original<typeof import('@/services/aioReadiness')>()), rewritePassage: rewriteMock }));
vi.mock('@/services/download', () => ({ downloadBlob: downloadMock }));
vi.mock('@/components/Results/copilotPatcher', () => ({
  CopilotPatcherPanel: () => <div data-testid="patcher" />,
  pageHasPatchContext: (page: unknown) => Boolean(page),
  patchTargetForPassage: () => ({}),
}));
vi.mock('@/components/Domain/OutreachTargetsPanel', () => ({ OutreachTargetsPanel: ({ targets, onExport }: { targets: unknown[]; onExport: (rows: unknown[]) => void }) => <><div data-testid="targets">{targets.length}</div><button onClick={() => onExport(targets)}>export</button></> }));
vi.mock('@/components/Domain/crawlResults/CrawlSummaryMetrics', () => ({ CrawlSummaryMetrics: () => <tr><td>metrics</td></tr> }));

beforeEach(async () => { await i18n.changeLanguage('en'); rewriteMock.mockReset(); });

const page = (url: string, score: number, extra: Record<string, unknown> = {}) => ({
  url, score, selfContainment: 50, spoDensity: 50, extractability: 50, language: 'en',
  coverage: 'full', chunkCount: 2, danglingCount: 0, tripleCount: 1, wordCount: 100, weakChunks: [], ...extra,
});

describe('coverage100 domain AIO edges', () => {
  it('renders an unchanged hero and sorts equal scores in both URL directions', () => {
    const report = { band: 'good', score: 70, weakPassages: [], scoredCount: 2, skippedCount: 0, basicRuleLanguages: [], selfContainment: 60, spoDensity: 60, extractability: 60 };
    render(<AioHero report={report as never} previous={{ score: 70 } as never} />);
    expect(screen.getByTestId('aio-score').textContent).toBe('70');
    const { unmount } = render(<AioPagesTable pages={[page('https://b.test/', 50), page('https://a.test/', 50)] as never} />);
    expect(screen.getAllByRole('row')[1].textContent).toContain('https://a.test/');
    unmount();
    render(<AioPagesTable pages={[page('https://a.test/', 50), page('https://c.test/', 50), page('https://b.test/', 50)] as never} />);
    render(<AioHero report={{ ...report, weakPassages: [{}], skippedCount: 1, basicRuleLanguages: ['pl'] } as never} previous={{ score: 60 } as never} />);
  });

  it('covers rewrite outcomes, copy, missing heading and patch context', async () => {
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboard }, configurable: true });
    const passage = { url: 'https://a.test/p', heading: '', windowIndex: 0, tokens: 12, score: 20, issues: [], text: 'old' };
    rewriteMock
      .mockResolvedValueOnce({ status: 'no-key' }).mockResolvedValueOnce({ status: 'empty' })
      .mockResolvedValueOnce({ status: 'error', message: 'limit' }).mockResolvedValueOnce({ status: 'ok', text: 'new' });
    render(<AioPassageCard passage={passage as never} index={0} />);
    const generate = () => fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI/ }));
    generate(); await waitFor(() => expect(screen.getByText(/Connect an AI provider/)).toBeTruthy());
    generate(); await waitFor(() => expect(screen.getByText(/returned no text/)).toBeTruthy());
    generate(); await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('limit'));
    generate(); await waitFor(() => expect(screen.getByTestId('aio-optimized').textContent).toContain('new'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith('new'));
    const view = render(<AioPassageCard passage={{ ...passage, heading: 'H' } as never} index={1} page={{} as never} />);
    expect(screen.getByTestId('patcher')).toBeTruthy();
    view.unmount();
  });

  it('renders report and overview empty fallbacks with no backlink report', () => {
    render(<BacklinkOutreachSection report={null} />);
    expect(screen.getByTestId('targets').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'export' }));
    const rejectedView = render(<CrawlOverviewTab session={{ result: { rejected_urls: [{ url: 'https://x.test/', reason: 'blocked' }] }, t: (key: string) => key } as never} />);
    expect(screen.getByText(/https:\/\/x\.test\//)).toBeTruthy();
    rejectedView.unmount();
    render(<CrawlOverviewTab session={{ result: {}, t: (key: string) => key } as never} />);
    expect(screen.getByText('crawl.ui.savedHttpValues')).toBeTruthy();
  });
});
