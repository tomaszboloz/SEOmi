import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlLinksTable } from '@/components/Domain/crawlResults/linksTab/CrawlLinksTable';
import { CrawlSocialFaviconCell } from '@/components/Domain/crawlResults/socialTab/CrawlSocialFaviconCell';
import { DomainComparisonTable } from '@/components/Domain/domainOverview/DomainComparisonTable';
import { createCrawlPageFixture } from './fixtures/crawl';
import type { CrawledPageSummary, DomainComparisonData } from '@/types';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('geminiGapFRONTEND_2 linksTable, socialFaviconCell, domainComparisonTable', () => {
  it('covers CrawlLinksTable source excerpt rendering, copy callback and empty state', () => {
    const copyLinkSource = vi.fn().mockResolvedValue(undefined);
    const t = ((key: string) => key) as never;

    const withExcerpt = {
      sourceUrl: 'https://site.test/from',
      key: 'link-1',
      link: {
        target_url: 'https://site.test/to', anchor_text: 'Link Text',
        is_internal: true, source_excerpt: '<code>const a = 1;</code>',
      },
    };

    const { rerender } = render(
      <CrawlLinksTable
        links={[withExcerpt]} linkEvidenceHref={() => ''}
        copiedLinkSourceKey={null} copyLinkSource={copyLinkSource} t={t}
      />,
    );

    expect(screen.getByText('crawl.ui.showSourceCode')).toBeTruthy();
    expect(screen.getByText('<code>const a = 1;</code>')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'crawl.ui.copyCode' }));
    expect(copyLinkSource).toHaveBeenCalledWith('link-1', '<code>const a = 1;</code>');

    rerender(
      <CrawlLinksTable
        links={[withExcerpt]} linkEvidenceHref={() => ''}
        copiedLinkSourceKey="link-1" copyLinkSource={copyLinkSource} t={t}
      />,
    );
    expect(screen.getByRole('button', { name: 'crawl.ui.copied' })).toBeTruthy();

    const noExcerpt = {
      sourceUrl: 'https://site.test/from', key: 'link-2',
      link: { target_url: 'https://site.test/to', anchor_text: 'Link 2', is_internal: true },
    };

    rerender(
      <CrawlLinksTable
        links={[noExcerpt]} linkEvidenceHref={() => ''}
        copiedLinkSourceKey={null} copyLinkSource={copyLinkSource} t={t}
      />,
    );
    expect(screen.getByText('crawl.ui.noExcerptOlderRun')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });

  it('covers CrawlSocialFaviconCell favicons vs metadata and empty declaration', () => {
    const t = ((key: string, p?: { value?: string }) => p?.value ?? key) as never;

    const faviconPage = createCrawlPageFixture({ favicons: ['/site-icon.png'] }) as CrawledPageSummary;
    const { rerender } = render(
      <table><tbody><tr><CrawlSocialFaviconCell page={faviconPage} t={t} /></tr></tbody></table>,
    );
    expect(screen.getByText('/site-icon.png')).toBeTruthy();

    const metaPage = createCrawlPageFixture({
      favicon_metadata: [{ href: '/meta-icon.svg', rel: 'shortcut icon', declared_sizes: '32x32' }],
    }) as CrawledPageSummary;

    rerender(<table><tbody><tr><CrawlSocialFaviconCell page={metaPage} t={t} /></tr></tbody></table>);
    expect(screen.getByText('/meta-icon.svg')).toBeTruthy();
    expect(screen.getByText(/shortcut icon/)).toBeTruthy();

    const emptyPage = createCrawlPageFixture({ favicons: [] }) as CrawledPageSummary;
    rerender(<table><tbody><tr><CrawlSocialFaviconCell page={emptyPage} t={t} /></tr></tbody></table>);
    expect(screen.getByText('crawl.social.noDeclaration')).toBeTruthy();
  });

  it('covers DomainComparisonTable competitors rendering, limit and missing section', () => {
    const t = ((key: string) => key) as never;

    const comparisonWithCompetitors: DomainComparisonData = {
      target: 'site.test', location_code: 2840, language_code: 'en', retrieved_at: 'now', source: 'dataforseo',
      rows: [{
        domain: 'site.test', organic_traffic: 500, organic_keywords: 200, domain_rank: 45, referring_domains: 50,
        total_backlinks: 1000, dofollow_ratio: 80, retrieved_at: 'now',
        competitors: [
          { domain: 'c1.test', common_keywords: 10, average_position: 2 },
          { domain: 'c2.test', common_keywords: null, average_position: 4 },
          { domain: 'c3.test', common_keywords: 8, average_position: 5 },
          { domain: 'c4.test', common_keywords: 6, average_position: 7 },
          { domain: 'c5.test', common_keywords: 4, average_position: 8 },
          { domain: 'c6.test', common_keywords: 2, average_position: 9 },
        ],
      }],
    };

    const { rerender } = render(<DomainComparisonTable comparison={comparisonWithCompetitors} t={t} />);
    expect(screen.getByText('domainResearchUi.competitors')).toBeTruthy();
    expect(screen.getByText('c1.test')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('c2.test')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('c5.test')).toBeTruthy();
    expect(screen.queryByText('c6.test')).toBeNull();

    const comparisonWithoutCompetitors: DomainComparisonData = {
      target: 'site.test', location_code: 2840, language_code: 'en', retrieved_at: 'now', source: 'dataforseo',
      rows: [{
        domain: 'site.test', organic_traffic: 500, organic_keywords: 200, domain_rank: 45, referring_domains: 50, retrieved_at: 'now',
        top_keywords: [{ keyword: 'seo test', position: 1, search_volume: null, traffic_share: null, intent: null }],
      }],
    };

    rerender(<DomainComparisonTable comparison={comparisonWithoutCompetitors} t={t} />);
    expect(screen.getByText('seo test')).toBeTruthy();
    expect(screen.queryByText('domainResearchUi.competitors')).toBeNull();
  });
});
