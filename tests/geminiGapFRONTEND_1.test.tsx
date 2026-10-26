import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { host } from '@/components/Domain/crawlResults/authority/authorityText';
import { CrawlFocusTab } from '@/components/Domain/crawlResults/focus/CrawlFocusTab';
import { CrawlLinksExternalCheck } from '@/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck';
import { createCrawlPageFixture } from './fixtures/crawl';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('geminiGapFRONTEND_1 authority, focus and linksExternalCheck', () => {
  it('covers host path extraction and catch fallback in authorityText line 30', () => {
    expect(host('https://example.test/about?q=1')).toBe('/about?q=1');
    expect(host('https://example.test')).toBe('/');
    expect(host('invalid-url')).toBe('invalid-url');
  });

  it('covers CrawlFocusTab gate toggle statements and functions line 98', () => {
    const page1 = createCrawlPageFixture({
      url: 'https://site.test/', final_url: 'https://site.test/', title: 'Home',
      document_language: 'en', http_status: 200, focus_terms: [{ term: 'home', surface: 'home', count: 1, weight: 1 }],
    }) as CrawledPageSummary;
    const page2 = createCrawlPageFixture({
      url: 'https://site.test/gated', final_url: 'https://site.test/gated', title: 'Gated',
      document_language: 'en', http_status: 200, meta_robots: 'noindex',
      focus_terms: [{ term: 'gated', surface: 'gated', count: 1, weight: 1 }],
    }) as CrawledPageSummary;

    render(<CrawlFocusTab pages={[page1, page2]} startUrl="https://site.test/" />);
    const toggleBtn = screen.getByRole('button', { name: /Include/i });
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Exclude/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Exclude/i }));
    expect(screen.getByRole('button', { name: /Include/i })).toBeTruthy();
  });

  it('covers CrawlLinksExternalCheck disabled early return and force check line 87', async () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const setLimit = vi.fn();
    const t = ((key: string) => key) as never;
    const run = { id: 'run-1', completedAt: 'now' } as CrawlRunRecord;

    const { rerender } = render(
      <CrawlLinksExternalCheck
        externalLinksCount={10} checkedExternalCount={0} blockedExternalCount={0}
        invalidExternalCount={0} uncheckedExternalCount={5} isCheckingExternalLinks={false}
        externalLinkCheckProgress={null} externalLinkLimit={100} setExternalLinkLimit={setLimit}
        currentRun={undefined} checkExternalLinks={checkFn} externalError={null} t={t}
      />,
    );
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(checkFn).not.toHaveBeenCalled();

    rerender(
      <CrawlLinksExternalCheck
        externalLinksCount={10} checkedExternalCount={5} blockedExternalCount={0}
        invalidExternalCount={0} uncheckedExternalCount={0} isCheckingExternalLinks={false}
        externalLinkCheckProgress={null} externalLinkLimit={250} setExternalLinkLimit={setLimit}
        currentRun={run} checkExternalLinks={checkFn} externalError={null} t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(checkFn).toHaveBeenCalledWith('run-1', 250, true);
  });
});
