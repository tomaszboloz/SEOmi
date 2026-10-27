import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolsStore } from '../src/stores/toolsStore';
import { useProjectStore } from '../src/stores/projectStore';
import { invokeTauriCommand } from '@/services/tauri';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';
import type { CrawlConfig } from '@/types';
import { createCrawlResultFixture } from './fixtures/crawl';
import { createInterruptedCheckpointFixture, createRecoveredPagesFixture } from './crawlRecoveryResumeConfigFixture';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
  isTauriEnvironment: vi.fn(() => true),
}));

describe('Issue #138: Crawl Recovery Resume Config Guard (Zustand Action)', () => {
  const { p3 } = createRecoveredPagesFixture();

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('seomi_active_project_v1', 'proj-resume-config');
    vi.mocked(invokeTauriCommand).mockReset();
    vi.mocked(invokeTauriCommand).mockImplementation(async (cmd: string) => {
      if (cmd === 'crawl_site') return createCrawlResultFixture({ pages: [p3], pages_crawled: 1 });
      if (cmd === 'store_append_crawl_events' || cmd === 'store_replace_crawl_runs') return undefined;
      return [];
    });
    useProjectStore.setState({ activeProjectId: 'proj-resume-config' });
    useToolsStore.setState({
      isCrawling: false,
      isCrawlPaused: false,
      crawlError: null,
      crawlConfig: DEFAULT_CRAWL_CONFIG,
      crawlRuns: [],
      interruptedCrawl: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('refuses silent crawl start with default config when checkpoint has no historical config', async () => {
    useToolsStore.setState({
      isCrawling: false,
      interruptedCrawl: createInterruptedCheckpointFixture({ config: undefined }),
    });

    // Action MUST NOT silently launch crawler with default UI crawlConfig when historical evidence is absent
    const result = await useToolsStore.getState().resumeInterruptedCrawl();
    const crawlCalls = vi.mocked(invokeTauriCommand).mock.calls.filter(([cmd]) => cmd === 'crawl_site');

    // RED PROOF: current controls.ts silently falls back to pending.config ?? get().crawlConfig and executes crawl_site
    expect(crawlCalls).toHaveLength(0);
    expect(result).toBeNull();
    expect(useToolsStore.getState().isCrawling).toBe(false);
  });

  it('resumes normally and preserves 2 recovered pages when checkpoint contains historical config', async () => {
    const historicalConfig: CrawlConfig = {
      ...DEFAULT_CRAWL_CONFIG,
      crawlMode: 'browser-rendered',
      maxConcurrentRequests: 8,
      userAgent: 'VerifiedBot/2.0',
    };

    useToolsStore.setState({
      isCrawling: false,
      interruptedCrawl: createInterruptedCheckpointFixture({ config: historicalConfig, environment: 'staging' }),
    });

    const result = await useToolsStore.getState().resumeInterruptedCrawl();
    const crawlCall = vi.mocked(invokeTauriCommand).mock.calls.find(([cmd]) => cmd === 'crawl_site');

    expect(crawlCall).toBeDefined();
    expect(crawlCall![1]).toMatchObject({
      startUrl: 'https://example.test/',
      config: expect.objectContaining({
        crawlMode: 'browser-rendered',
        maxConcurrentRequests: 8,
        userAgent: 'VerifiedBot/2.0',
        resumeCompletedUrls: expect.arrayContaining(['https://example.test/p1', 'https://example.test/p2']),
        resumeFrontierUrls: expect.arrayContaining(['https://example.test/p3']),
      }),
    });
    expect(result?.pages).toHaveLength(3);
    expect(result?.pages.map((p) => p.url)).toEqual(expect.arrayContaining([
      'https://example.test/p1',
      'https://example.test/p2',
      'https://example.test/p3',
    ]));
  });

  it('allows explicit config selection to resume recovered crawl and preserves 2 recovered pages', async () => {
    const explicitConfig: CrawlConfig = {
      ...DEFAULT_CRAWL_CONFIG,
      crawlMode: 'http',
      maxConcurrentRequests: 6,
      userAgent: 'ExplicitUserChoice/1.0',
    };

    useToolsStore.setState({
      isCrawling: false,
      interruptedCrawl: createInterruptedCheckpointFixture({ config: undefined }),
    });

    // Explicit choice passed to resumeInterruptedCrawl action allows resuming safely
    const result = await (useToolsStore.getState().resumeInterruptedCrawl as any)(explicitConfig);
    const crawlCall = vi.mocked(invokeTauriCommand).mock.calls.find(([cmd]) => cmd === 'crawl_site');

    expect(crawlCall).toBeDefined();
    expect(crawlCall![1]).toMatchObject({
      config: expect.objectContaining({
        crawlMode: 'http',
        maxConcurrentRequests: 6,
        userAgent: 'ExplicitUserChoice/1.0',
        resumeCompletedUrls: expect.arrayContaining(['https://example.test/p1', 'https://example.test/p2']),
      }),
    });
    expect(result?.pages).toHaveLength(3);
  });
});
