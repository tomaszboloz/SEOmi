import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrawlResumePanel } from '@/components/Domain/siteAudit/CrawlResumePanel';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import i18n from '@/i18n';

describe('CrawlResumePanel configuration disclosure and conscious choice', () => {
  it('renders standard resume button without notice when historical config is preserved', () => {
    const resumeInterruptedCrawl = vi.fn().mockResolvedValue(null);
    const discardInterruptedCrawl = vi.fn();
    const session = {
      interruptedCrawl: {
        url: 'https://example.test/',
        limit: 100,
        config: DEFAULT_CRAWL_CONFIG,
        startedAt: '2026-10-25T10:00:00Z',
        completedUrls: ['https://example.test/'],
        frontierUrls: [],
      },
      crawlConfig: DEFAULT_CRAWL_CONFIG,
      resumeInterruptedCrawl,
      discardInterruptedCrawl,
      t: (key: string, params?: Record<string, unknown>) => i18n.t(key, params),
    } as unknown as Parameters<typeof CrawlResumePanel>[0]['session'];

    render(<CrawlResumePanel session={session} />);

    expect(screen.queryByText(i18n.t('siteAudit.interruptedMissingConfigNotice'))).toBeNull();
    const resumeBtn = screen.getByRole('button', { name: i18n.t('siteAudit.resumeCrawl') });
    expect(resumeBtn).toBeDefined();

    fireEvent.click(resumeBtn);
    expect(resumeInterruptedCrawl).toHaveBeenCalledExactlyOnceWith();
  });

  it('renders notice and explicit resume button passing current config when historical config is missing', () => {
    const resumeInterruptedCrawl = vi.fn().mockResolvedValue(null);
    const discardInterruptedCrawl = vi.fn();
    const currentConfig = { ...DEFAULT_CRAWL_CONFIG, maxConcurrentRequests: 7 };
    const session = {
      interruptedCrawl: {
        url: 'https://example.test/',
        limit: 50,
        config: undefined,
        startedAt: undefined,
        completedUrls: ['https://example.test/page1'],
        frontierUrls: [],
      },
      crawlConfig: currentConfig,
      resumeInterruptedCrawl,
      discardInterruptedCrawl,
      t: (key: string, params?: Record<string, unknown>) => i18n.t(key, params),
    } as unknown as Parameters<typeof CrawlResumePanel>[0]['session'];

    render(<CrawlResumePanel session={session} />);

    expect(screen.getByText(i18n.t('siteAudit.interruptedMissingConfigNotice'))).toBeDefined();
    expect(screen.queryByRole('button', { name: i18n.t('siteAudit.resumeCrawl') })).toBeNull();

    const explicitBtn = screen.getByRole('button', { name: i18n.t('siteAudit.resumeWithCurrentConfig') });
    expect(explicitBtn).toBeDefined();

    fireEvent.click(explicitBtn);
    expect(resumeInterruptedCrawl).toHaveBeenCalledExactlyOnceWith(currentConfig);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('siteAudit.discard') }));
    expect(discardInterruptedCrawl).toHaveBeenCalledTimes(1);
  });
});
