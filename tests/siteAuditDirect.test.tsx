import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAudit } from '@/components/Domain/SiteAudit';

const useSession = vi.hoisted(() => vi.fn());
vi.mock('@/components/Domain/siteAudit/useSiteAuditSession', () => ({ useSiteAuditSession: useSession }));
vi.mock('@/components/Domain/siteAudit/CrawlWorkspaceHeader', () => ({ CrawlWorkspaceHeader: () => <div data-testid="header" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlWorkspaceNotices', () => ({ CrawlWorkspaceNotices: () => <div data-testid="notices" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlStartControls', () => ({ CrawlStartControls: () => <div data-testid="start" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlEnvironmentComparison', () => ({ CrawlEnvironmentComparison: () => <div data-testid="environment" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlConfigurationForm', () => ({ CrawlConfigurationForm: () => <div data-testid="configuration" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlCustomSearchEditor', () => ({ CrawlCustomSearchEditor: () => <div data-testid="custom-search" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlUrlRules', () => ({ CrawlUrlRules: () => <div data-testid="url-rules" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlSavedRequestProfiles', () => ({ CrawlSavedRequestProfiles: () => <div data-testid="profiles" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlResumePanel', () => ({ CrawlResumePanel: () => <div data-testid="resume" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlProgressStatus', () => ({ CrawlProgressStatus: () => <div data-testid="progress" /> }));
vi.mock('@/components/Domain/siteAudit/CrawlLegacyHistory', () => ({ CrawlLegacyHistory: () => <div data-testid="history" /> }));
vi.mock('@/components/Domain/CrawlResultsTabs', () => ({ CrawlResultsTabs: () => <div data-testid="results" /> }));
vi.mock('@/components/Domain/ScheduledAuditsPanel', () => ({ ScheduledAuditsPanel: () => <div data-testid="scheduled" /> }));

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;
const base = {
  activeProjectId: null, crawlConfig: { allowSubdomains: false, includePatterns: [], excludePatterns: [], requestProfileId: '' },
  crawlRequestProfiles: [], crawlResult: null, crawlRuns: [], crawlUrl: '', customSearches: [],
  deleteCrawlRun: vi.fn(), desktopAvailable: false, filterValidationError: null, inputUrl: '',
  interruptedCrawl: null, isCrawling: false, mapNavigationRequest: null, mapRequiresCrawl: false,
  selectCrawlRun: vi.fn(), selectedLimit: 25, selectedRun: null, t,
};

beforeEach(() => useSession.mockReset());

describe('SiteAudit facade direct contracts', () => {
  it('shows crawl-required, desktop and filter error states without project/results', () => {
    useSession.mockReturnValue({ ...base, mapRequiresCrawl: true, filterValidationError: 'bad filter' });
    const { container } = render(<SiteAudit />);
    expect(container.firstElementChild?.className).not.toContain('pb-28');
    expect(screen.getByText('siteAudit.mapRequiresCrawl')).toBeTruthy();
    expect(screen.getByText('runtimeErrors.tauri.desktopOnly')).toBeTruthy();
    expect(screen.getByText('bad filter')).toBeTruthy();
    expect(screen.queryByTestId('scheduled')).toBeNull();
    expect(screen.queryByTestId('results')).toBeNull();
  });

  it('renders project-scoped panels, interrupted resume and saved results', () => {
    const result = { pages: [], sitemap_urls: [] };
    useSession.mockReturnValue({
      ...base, activeProjectId: 'project-one', desktopAvailable: true, crawlResult: result,
      crawlConfig: { ...base.crawlConfig, allowSubdomains: true, requestProfileId: 'saved' },
      crawlRequestProfiles: [{ id: 'saved', name: 'Saved profile' }],
      interruptedCrawl: { runId: 'interrupted' }, mapRequiresCrawl: true,
    });
    const { container } = render(<SiteAudit />);
    expect(container.firstElementChild?.className).toContain('pb-28');
    expect(screen.getByTestId('scheduled')).toBeTruthy();
    expect(screen.getByTestId('environment')).toBeTruthy();
    expect(screen.getByTestId('resume')).toBeTruthy();
    expect(screen.getByTestId('results')).toBeTruthy();
    expect(screen.getByTestId('history')).toBeTruthy();
    expect(screen.getByText(/siteAudit\.scopeSubdomains/)).toBeTruthy();
    expect(screen.getByText('Saved profile')).toBeTruthy();
    expect(screen.queryByText('siteAudit.mapRequiresCrawl')).toBeNull();
  });

  it('falls back to the request-profile summary when a saved profile is missing', () => {
    useSession.mockReturnValue({
      ...base,
      crawlConfig: { ...base.crawlConfig, requestProfileId: 'missing' },
    });
    render(<SiteAudit />);
    expect(screen.getByText('siteAudit.requestProfileSummary')).toBeTruthy();
  });

  it('shows live progress and suppresses resume while crawling', () => {
    useSession.mockReturnValue({ ...base, desktopAvailable: true, isCrawling: true, interruptedCrawl: { runId: 'live' } });
    render(<SiteAudit />);
    expect(screen.getByTestId('progress')).toBeTruthy();
    expect(screen.queryByTestId('resume')).toBeNull();
  });
});
