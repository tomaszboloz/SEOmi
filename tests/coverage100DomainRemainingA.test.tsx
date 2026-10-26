import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AioHero } from '@/components/Domain/crawlResults/aio/AioHero';
import { CrawlOverviewTab } from '@/components/Domain/crawlResults/CrawlOverviewTab';
import { TrustHero } from '@/components/Domain/crawlResults/trust/TrustHero';
import { DomainComparisonTable } from '@/components/Domain/domainOverview/DomainComparisonTable';
import { barFor, host, pillarName, toneFor } from '@/components/Domain/crawlResults/authority/authorityText';

vi.mock('@/components/Domain/crawlResults/CrawlSummaryMetrics', () => ({ CrawlSummaryMetrics: () => <tr><td>metrics</td></tr> }));

const report = {
  band: 'good', score: 64, weakPassages: [], scoredCount: 1, skippedCount: 0,
  basicRuleLanguages: [], selfContainment: 60, spoDensity: 70, extractability: 62,
};

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('coverage100 domain remaining A', () => {
  it('renders AIO without history, an empty rejection list, and a negative trust delta', () => {
    const aio = render(<AioHero report={report as never} />);
    expect(screen.getByTestId('aio-score').textContent).toBe('64');
    aio.unmount();
    const unchanged = render(<AioHero report={report as never} previous={{ score: 64 } as never} />);
    expect(screen.queryByText(i18n.t('aio.hero.change', { delta: '0' }))).toBeNull();
    unchanged.unmount();
    const decreased = render(<AioHero report={report as never} previous={{ score: 65 } as never} />);
    expect(screen.getByText(i18n.t('aio.hero.change', { delta: '-1' }))).toBeTruthy();
    decreased.unmount();

    const overview = render(<CrawlOverviewTab session={{ result: { rejected_urls: [] }, t: i18n.t } as never} />);
    expect(screen.getByText(i18n.t('crawl.ui.savedHttpValues'))).toBeTruthy();
    overview.unmount();

    const trust = {
      score: 40, level: 'adequate', articleCount: 1, pageCount: 2, layers: {},
      ymyl: undefined, ymylUnattributedPct: 0,
      citations: { pagesAnalyzed: 0, pagesWithTrusted: 0, pagesWithAnyExternal: 0, trustedLinks: 0, externalLinks: 0, checkedLinks: 0, deadLinks: [], pagesWithScholarly: 0, scholarlySources: 0 },
    };
    render(<TrustHero report={trust as never} previous={{ score: 41, at: '', runId: '', layers: {} }} />);
    expect(screen.getByText(i18n.t('trust.hero.previous', { score: 41, delta: '-1' }))).toBeTruthy();
  });

  it('covers authority colour bands and URL fallbacks', () => {
    expect(toneFor(null)).toBe('text-slate-500');
    expect([90, 75, 60, 40, 0].map(toneFor)).toEqual(['text-emerald-300', 'text-lime-300', 'text-amber-300', 'text-orange-300', 'text-rose-300']);
    expect([null, 90, 75, 60, 40, 0].map(barFor)).toEqual(['bg-slate-700', 'bg-emerald-500', 'bg-lime-400', 'bg-amber-400', 'bg-orange-500', 'bg-rose-500']);
    expect(pillarName(i18n.t.bind(i18n) as never, 'general', 'ignored')).toBe(i18n.t('authority.coverage.general'));
    expect(pillarName(i18n.t.bind(i18n) as never, 'other', 'Other')).toBe('Other');
    expect(host('https://example.test/docs?q=1')).toBe('/docs?q=1');
    expect(host('https://example.test/')).toBe('/');
    expect(host('not a URL')).toBe('not a URL');
  });

  it('renders competitor detail values when common keyword count is absent', () => {
    render(<DomainComparisonTable t={i18n.t.bind(i18n) as never} comparison={{
      target: 'site.test',
      rows: [{
        domain: 'site.test', organic_traffic: null, organic_keywords: null, domain_rank: null,
        referring_domains: null, total_backlinks: null, dofollow_ratio: null,
        top_keywords: [{ keyword: 'coffee', position: null }], top_pages: [{ url: 'https://site.test/coffee' }],
        competitors: [{ domain: 'rival.test', common_keywords: null }],
      }],
    } as never} />);
    expect(screen.getByText('rival.test')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
