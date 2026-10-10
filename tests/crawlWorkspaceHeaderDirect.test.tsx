import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlWorkspaceHeader } from '@/components/Domain/siteAudit/CrawlWorkspaceHeader';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;
const makeSession = (crawlResult: unknown, setMapNavigationRequest = vi.fn()) => ({
  crawlResult,
  setMapNavigationRequest,
  t: (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}`,
} as unknown as Session);

describe('CrawlWorkspaceHeader direct contracts', () => {
  it('keeps the header informational when no crawl result exists', () => {
    render(<CrawlWorkspaceHeader session={makeSession(null)} />);
    expect(screen.getByText('siteAudit.headerBadge')).toBeTruthy();
    expect(screen.getByText('siteAudit.headerCrawler')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'siteAudit.title' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows both map entry points and results navigation for a completed crawl', () => {
    const setMapNavigationRequest = vi.fn();
    render(<CrawlWorkspaceHeader session={makeSession({ pages_crawled: 7 }, setMapNavigationRequest)} />);
    const mapButtons = screen.getAllByRole('button', { name: 'siteAudit.openMapAria:7' });
    expect(mapButtons).toHaveLength(2);
    expect(screen.getByRole('navigation', { name: 'siteAudit.resultsNavAria' })).toBeTruthy();
    expect(screen.getByText('siteAudit.resultsCount:7')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'siteAudit.resultsLink' }).getAttribute('href')).toBe('#crawl-results');
    expect(screen.getByText('7')).toBeTruthy();
    fireEvent.click(mapButtons[0]);
    fireEvent.click(mapButtons[1]);
    expect(setMapNavigationRequest).toHaveBeenCalledTimes(2);
    const update = setMapNavigationRequest.mock.calls[0][0] as (value: number) => number;
    expect(update(4)).toBe(5);
  });
});
