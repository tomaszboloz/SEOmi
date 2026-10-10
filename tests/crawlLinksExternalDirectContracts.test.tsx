import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { CrawlLinksExternalCheck } from '@/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck';
import { createCrawlRunFixture } from './fixtures/crawl';

const t = ((key: string) => key) as unknown as TFunction;

describe('CrawlLinksExternalCheck direct contracts', () => {
  it('omits the check section when there are no external links', () => {
    const { container } = render(
      <CrawlLinksExternalCheck
        externalLinksCount={0}
        checkedExternalCount={0}
        blockedExternalCount={0}
        invalidExternalCount={0}
        uncheckedExternalCount={0}
        isCheckingExternalLinks={false}
        externalLinkCheckProgress={null}
        externalLinkLimit={100}
        setExternalLinkLimit={vi.fn()}
        checkExternalLinks={vi.fn().mockResolvedValue(undefined)}
        externalError={null}
        t={t}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('exposes counts, limit changes, errors, and the missing-run guard', () => {
    const setExternalLinkLimit = vi.fn();
    const checkExternalLinks = vi.fn().mockResolvedValue(undefined);
    render(
      <CrawlLinksExternalCheck
        externalLinksCount={4}
        checkedExternalCount={1}
        blockedExternalCount={1}
        invalidExternalCount={1}
        uncheckedExternalCount={1}
        isCheckingExternalLinks={false}
        externalLinkCheckProgress={null}
        externalLinkLimit={250}
        setExternalLinkLimit={setExternalLinkLimit}
        checkExternalLinks={checkExternalLinks}
        externalError="network unavailable"
        t={t}
      />,
    );

    expect(screen.getByText('crawl.ui.externalTargetCheck')).toBeTruthy();
    expect(screen.getByText('crawl.ui.externalTargetSummary')).toBeTruthy();
    expect(screen.getByText('network unavailable')).toBeTruthy();
    const select = screen.getByRole('combobox', { name: 'crawl.ui.externalLinkLimit' });
    expect((select as HTMLSelectElement).value).toBe('250');
    fireEvent.change(select, { target: { value: '500' } });
    expect(setExternalLinkLimit).toHaveBeenCalledWith(500);

    const button = screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    button.removeAttribute('disabled');
    fireEvent.click(button);
    expect(checkExternalLinks).not.toHaveBeenCalled();
  });

  it('starts an unchecked check and forces a completed recheck when nothing is unchecked', () => {
    const run = createCrawlRunFixture({ id: 'run-1' });
    const checkExternalLinks = vi.fn().mockResolvedValue(undefined);
    const props = {
      externalLinksCount: 2,
      checkedExternalCount: 1,
      blockedExternalCount: 0,
      invalidExternalCount: 0,
      isCheckingExternalLinks: false,
      externalLinkCheckProgress: null,
      externalLinkLimit: 100,
      setExternalLinkLimit: vi.fn(),
      currentRun: run,
      checkExternalLinks,
      externalError: null,
      t,
    };
    const view = render(
      <CrawlLinksExternalCheck {...props} uncheckedExternalCount={1} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' }));
    expect(checkExternalLinks).toHaveBeenLastCalledWith('run-1', 100);

    view.rerender(<CrawlLinksExternalCheck {...props} uncheckedExternalCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' }));
    expect(checkExternalLinks).toHaveBeenLastCalledWith('run-1', 100, true);
  });

  it('shows live progress, connection fallback, and checking state', () => {
    const props = {
      externalLinksCount: 1,
      checkedExternalCount: 0,
      blockedExternalCount: 0,
      invalidExternalCount: 0,
      uncheckedExternalCount: 1,
      isCheckingExternalLinks: true,
      externalLinkCheckProgress: { completed: 2, total: 3, currentUrl: 'https://remote.test/' },
      externalLinkLimit: 100,
      setExternalLinkLimit: vi.fn(),
      currentRun: createCrawlRunFixture({ id: 'run-2' }),
      checkExternalLinks: vi.fn().mockResolvedValue(undefined),
      externalError: null,
      t,
    };
    const view = render(<CrawlLinksExternalCheck {...props} />);
    expect(screen.getByRole('status').textContent).toContain('https://remote.test/');
    expect((screen.getByRole('button', { name: 'crawl.ui.checking' }) as HTMLButtonElement).disabled).toBe(true);

    view.rerender(
      <CrawlLinksExternalCheck
        {...props}
        externalLinkCheckProgress={{ completed: 3, total: 3 }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('crawl.ui.connecting');
  });
});
