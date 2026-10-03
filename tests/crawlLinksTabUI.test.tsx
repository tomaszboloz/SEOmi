import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlLinksInternalSummary } from '@/components/Domain/crawlResults/linksTab/CrawlLinksInternalSummary';
import { CrawlLinksExternalCheck } from '@/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck';
import { CrawlLinksTable } from '@/components/Domain/crawlResults/linksTab/CrawlLinksTable';

const mockT = ((key: string) => key) as any;

describe('CrawlLinksTab UI components', () => {
  it('renders CrawlLinksInternalSummary when internal links exist', () => {
    const { rerender } = render(
      <CrawlLinksInternalSummary
        internalLinksCount={0}
        uniqueCount={0}
        checkedCount={0}
        brokenCount={0}
        uncheckedCount={0}
        t={mockT}
      />,
    );
    expect(screen.queryByText('crawl.ui.internalTargetCheck')).toBeNull();

    rerender(
      <CrawlLinksInternalSummary
        internalLinksCount={5}
        uniqueCount={5}
        checkedCount={4}
        brokenCount={1}
        uncheckedCount={1}
        t={mockT}
      />,
    );
    expect(screen.getByText('crawl.ui.internalTargetCheck')).toBeTruthy();
    expect(screen.getByText('crawl.ui.uncheckedTargetNote')).toBeTruthy();
  });

  it('renders CrawlLinksExternalCheck and triggers check callback', () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);

    render(
      <CrawlLinksExternalCheck
        externalLinksCount={3}
        checkedExternalCount={1}
        blockedExternalCount={0}
        invalidExternalCount={0}
        uncheckedExternalCount={2}
        isCheckingExternalLinks={false}
        externalLinkCheckProgress={null}
        externalLinkLimit={100}
        setExternalLinkLimit={vi.fn()}
        currentRun={{ id: 'run-1', completedAt: '', startUrl: 'https://example.com', config: {} as any, result: {} as any }}
        checkExternalLinks={checkFn}
        externalError={null}
        t={mockT}
      />,
    );

    const button = screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' });
    fireEvent.click(button);
    expect(checkFn).toHaveBeenCalledWith('run-1', 100);
  });

  it('renders CrawlLinksTable with link rows', () => {
    const linkItems = [
      {
        sourceUrl: 'https://example.com/p1',
        link: { target_url: 'https://example.com/p2', is_internal: true, anchor_text: 'Go to P2', target_http_status: 200 },
        key: 'k1',
      },
    ];

    render(
      <CrawlLinksTable
        links={linkItems}
        linkEvidenceHref={(s, t) => `#${s}->${t}`}
        copiedLinkSourceKey={null}
        copyLinkSource={vi.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByText('Go to P2')).toBeTruthy();
    expect(screen.getByText('https://example.com/p2')).toBeTruthy();
  });
});
