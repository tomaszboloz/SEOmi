import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlFocusTab } from '@/components/Domain/crawlResults/focus/CrawlFocusTab';
import { FocusHero } from '@/components/Domain/crawlResults/focus/FocusHero';
import { CrawlLinksExternalCheck } from '@/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck';
import { CrawlSocialFaviconCell } from '@/components/Domain/crawlResults/socialTab/CrawlSocialFaviconCell';
import { TrustEntities } from '@/components/Domain/crawlResults/trust/TrustEntities';
import { TrustHero } from '@/components/Domain/crawlResults/trust/TrustHero';
import { TrustSignals } from '@/components/Domain/crawlResults/trust/TrustSignals';
import { buildTrustReport } from '@/services/eeatTrust';
import { diabetesFocus, diabetesPages, trustedArticle } from './eeatTrustFixtures';

vi.mock('@/hooks/useSiteFocus', () => ({ useSiteFocus: () => ({
  report: { score: 70, band: 'good', pages: [], recommendations: [], generatedAt: '2026-01-01', pageCount: 0 },
  manualTopic: null, history: [], annotations: [], recomputeBudget: { remaining: 1, limit: 2 }, setManualTopic: vi.fn(), recompute: vi.fn(),
}) }));
vi.mock('@/components/Domain/crawlResults/focus/GateBanner', () => ({ GateBanner: () => <div>gate</div> }));
vi.mock('@/components/Domain/crawlResults/focus/FocusBanners', () => ({ FocusBanners: () => <div>banners</div> }));
vi.mock('@/components/Domain/crawlResults/focus/ProtectionPanel', () => ({ ProtectionPanel: () => <div>protection</div> }));
vi.mock('@/components/Domain/crawlResults/focus/FocusHistoryChart', () => ({ FocusHistoryChart: () => <div>chart</div> }));
vi.mock('@/components/Domain/crawlResults/focus/WeeklySummaryCard', () => ({ WeeklySummaryCard: () => <div>weekly</div> }));
vi.mock('@/components/Domain/crawlResults/focus/CoreTopicPanel', () => ({ CoreTopicPanel: () => <div>topic</div> }));
vi.mock('@/components/Domain/crawlResults/focus/FocusMetricsStrip', () => ({ FocusMetricsStrip: () => <div>metrics</div> }));
vi.mock('@/components/Domain/crawlResults/focus/SubSiteScores', () => ({ SubSiteScores: () => <div>subsites</div> }));
vi.mock('@/components/Domain/crawlResults/focus/FocusHeatmapTree', () => ({ FocusHeatmapTree: () => <div>heatmap</div> }));
vi.mock('@/components/Domain/crawlResults/focus/PageFocusDetail', () => ({ PageFocusDetail: () => <div>detail</div> }));
vi.mock('@/components/Domain/crawlResults/focus/SiteRecommendations', () => ({ SiteRecommendations: () => <div>recommendations</div> }));
vi.mock('@/components/Domain/crawlResults/focus/benchmark/FocusBenchmarkSection', () => ({ FocusBenchmarkSection: () => <div>benchmark</div> }));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('coverage100 focus, trust and crawl edges', () => {
  it('renders the focus tab gate and the unavailable hero branch', () => {
    render(<CrawlFocusTab pages={[]} startUrl="https://example.test/" run={{ id: 'r', result: { sitemap_urls: [] } } as never} />);
    expect(screen.getByText('gate')).toBeTruthy();
    render(<FocusHero report={{ score: 0, band: 'critical', pages: [], generatedAt: '2026-01-01', pageCount: 0, unavailable: true } as never} onRecalculate={() => undefined} />);
    expect(screen.getByTestId('focus-unavailable')).toBeTruthy();
    const onRecalc = vi.fn();
    const availableReport = {
      score: 75, band: 'good', generatedAt: '2026-01-01', pageCount: 10, unavailable: false,
      pages: [{ url: 'https://x.test/1', trs: 20, skipped: false, type: 'article' }],
    };
    const heroView = render(<FocusHero report={availableReport as never} onRecalculate={onRecalc} history={[{ score: 70 } as never]} recalcNote="Budget note" />);
    expect(screen.getByTestId('focus-score').textContent).toBe('75');
    fireEvent.click(screen.getByLabelText('focus.hero.metaButton'));
    expect(screen.getByText('Budget note')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'focus.hero.recalc' }));
    expect(onRecalc).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'focus.hero.howItWorks' }));
    heroView.unmount();
  });

  it('guards a missing current run and renders legacy favicon URLs', () => {
    const check = vi.fn();
    render(<CrawlLinksExternalCheck externalLinksCount={1} checkedExternalCount={0} blockedExternalCount={0} invalidExternalCount={0} uncheckedExternalCount={1} isCheckingExternalLinks={false} externalLinkCheckProgress={null} externalLinkLimit={100} setExternalLinkLimit={vi.fn()} checkExternalLinks={check} externalError={null} t={((key: string) => key) as never} />);
    const button = screen.getByRole('button', { name: 'crawl.ui.checkExternalLinks' });
    button.removeAttribute('disabled');
    fireEvent.click(button);
    expect(check).not.toHaveBeenCalled();
    render(<table><tbody><tr><CrawlSocialFaviconCell page={{ url: 'https://x.test/', favicons: ['https://x.test/icon'], favicon_metadata: [] } as never} t={i18n.t} /></tr></tbody></table>);
    expect(screen.getByText('https://x.test/icon')).toBeTruthy();
    render(<table><tbody><tr><CrawlSocialFaviconCell page={{ url: 'https://empty.test/', favicons: [], favicon_metadata: [] } as never} t={i18n.t} /></tr></tbody></table>);
    expect(screen.getByText(i18n.t('crawl.social.noDeclaration'))).toBeTruthy();
    const metaPage = {
      url: 'https://meta.test/',
      favicons: [],
      favicon_metadata: [
        { href: 'https://meta.test/icon.png', rel: 'icon', declared_type: 'image/png', declared_sizes: '32x32', inferred_format: 'png' },
        { href: 'https://meta.test/err.ico', rel: 'shortcut' },
        { href: 'https://meta.test/uncheck.ico' },
      ],
      favicon_resource_checks: [
        { url: 'https://meta.test/icon.png', checked_in_run: true, http_status: 200, content_length: 1024, intrinsic_width: 32, intrinsic_height: 32, dimensions_source: 'svg', content_type: 'image/png' },
        { url: 'https://meta.test/err.ico', checked_in_run: true, request_error_kind: 'dns' },
        { url: 'https://meta.test/uncheck.ico', checked_in_run: false },
      ],
    };
    render(<table><tbody><tr><CrawlSocialFaviconCell page={metaPage as never} t={i18n.t} /></tr></tbody></table>);
    expect(screen.getByText(/32 × 32/)).toBeTruthy();
  });

  it('handles missing trust organization, source status and transparency pages', () => {
    const pages = diabetesPages().map((page) => page.url.includes('/articles/') ? trustedArticle(page) : page);
    const base = buildTrustReport(pages, diabetesFocus(), { now: '2026-10-16T00:00:00Z' });
    const sparse = { ...base, schema: { ...base.schema, organization: { present: false, hasId: false, sameAs: [] } }, authors: [], citations: { ...base.citations, deadLinks: [{ page: 'p', target: 'https://gone.test/' }] }, transparency: { ...base.transparency, articles: 0, found: {} }, ymylUnattributedPct: 10 };
    render(<TrustHero report={sparse as never} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    render(<TrustHero report={sparse as never} previous={{ at: '', runId: '', score: sparse.score - 1, layers: {} }} />);
    render(<TrustSignals report={sparse as never} />);
    expect(screen.getByText(/gone.test/)).toBeTruthy();
    render(<TrustSignals report={{ ...sparse, transparency: { ...sparse.transparency, found: { editorial: 'https://x.test/' } } } as never} />);
    render(<TrustEntities report={sparse as never} onGenerate={() => undefined} />);
    expect(screen.getByText(/No Organization entity/)).toBeTruthy();
    render(<TrustEntities report={{ ...sparse, schema: { ...sparse.schema, organization: { present: true, hasId: false, sameAs: [], name: undefined } }, authors: [{ ...base.authors[0], sameAs: [], alignmentPct: undefined }] } as never} onGenerate={() => undefined} />);
    expect(screen.getByText(/Publisher: -\./)).toBeTruthy();
  });
});
