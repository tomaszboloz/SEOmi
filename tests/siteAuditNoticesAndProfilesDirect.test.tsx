import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlWorkspaceNotices } from '@/components/Domain/siteAudit/CrawlWorkspaceNotices';
import { CrawlSavedRequestProfiles } from '@/components/Domain/siteAudit/CrawlSavedRequestProfiles';

vi.mock('@/components/Domain/siteAudit/CrawlRequestProfileForm', () => ({
  CrawlRequestProfileForm: () => <div data-testid="request-profile-form" />,
}));
const t = (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key;
const notices = (patch: Record<string, unknown> = {}) => ({
  crawlError: null, crawlPersistenceCompacted: false, crawlPersistenceError: null, crawlPersistenceNotice: null,
  crawlResult: null, crawlRuns: [], isRetryingCrawlPersistence: false, retryCrawlPersistence: vi.fn(), t, ...patch,
});
const profiles = (patch: Record<string, unknown> = {}) => ({
  crawlConfig: { requestProfileId: 'plain', userAgent: '' },
  crawlRequestProfiles: [{ id: 'plain', name: 'Plain', hasCookie: false, hasHeaders: false, hasProxy: false }],
  isSavingCrawlRequestProfile: true, removeRequestProfile: vi.fn(), requestProfileStatus: 'failed',
  requestProfileStatusIsError: true, saveRequestProfile: vi.fn(), selectRequestProfile: vi.fn(), setCrawlConfig: vi.fn(), t, ...patch,
});

describe('site audit notices and request profile edge contracts', () => {
  it('renders retrying, saved and recovered persistence states and suppresses stale notices', () => {
    const retry = vi.fn();
    const { rerender } = render(<CrawlWorkspaceNotices session={notices({
      crawlPersistenceError: 'disk full', isRetryingCrawlPersistence: true, retryCrawlPersistence: retry,
    }) as never} />);
    expect((screen.getByRole('button', { name: 'siteAudit.retryingSave' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<CrawlWorkspaceNotices session={notices({ crawlPersistenceNotice: 'saved' }) as never} />);
    expect(screen.getByText('crawl.persistence.savedTitle')).toBeTruthy();
    rerender(<CrawlWorkspaceNotices session={notices({ crawlPersistenceNotice: 'compact', crawlPersistenceCompacted: true }) as never} />);
    expect(screen.getByText('crawl.persistence.recoveredTitle')).toBeTruthy();
    rerender(<CrawlWorkspaceNotices session={notices({ crawlPersistenceNotice: 'stale', crawlPersistenceError: 'new error' }) as never} />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<CrawlWorkspaceNotices session={notices({
      crawlPersistenceError: 'disk full', crawlRuns: [{}], retryCrawlPersistence: retry,
    }) as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'siteAudit.retrySave' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows profile flags, disabled save state and an error status', () => {
    render(<CrawlSavedRequestProfiles session={profiles() as never} />);
    expect(screen.getByRole('option', { name: 'Plain' }).textContent).toBe('Plain');
    expect(screen.getByTestId('request-profile-form')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'siteAudit.saving' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('failed').className).toContain('border-rose');
  });
});
