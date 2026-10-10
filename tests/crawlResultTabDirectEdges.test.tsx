import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlMetadataTab } from '@/components/Domain/crawlResults/CrawlMetadataTab';
import { CrawlClientRedirectsSection } from '@/components/Domain/crawlResults/directivesTab/CrawlClientRedirectsSection';

const t = ((key: string, values?: Record<string, unknown>) => values?.visible !== undefined ? `${key} ${values.visible}/${values.total}` : key) as any;

describe('crawl result tab direct contracts', () => {
  it('renders metadata values and forwards a selected facet', () => {
    const setMetadataFacet = vi.fn();
    const page = (url: string, title: unknown, description: unknown) => ({ url, title, meta_description: description, title_length: null, meta_description_length: null });
    const rows = [{ page: page('https://example.com/missing', undefined, undefined), facets: ['missing-title', 'missing-description'] }, { page: page('https://example.com/empty', '', ''), facets: [] }];
    render(<CrawlMetadataTab session={{ filteredMetadataRows: rows, metadataRows: rows, metadataFacet: 'all', metadataFacetCounts: { all: 2, 'missing-title': 1 } as any, localizedFacetLabel: (facet: any) => `facet:${facet.id}`, localizedFacetDescription: (facet: any) => `description:${facet.id}`, setMetadataFacet, t } as any} />);
    expect(screen.getByText('crawl.ui.urlCount 2/2')).toBeTruthy();
    expect(screen.getByText('https://example.com/missing')).toBeTruthy();
    expect(screen.getByText('crawl.ui.missingTag')).toBeTruthy();
    expect(screen.getByText('crawl.ui.missingTagOrData')).toBeTruthy();
    expect(screen.getAllByText('crawl.ui.emptyValue')).toHaveLength(2);
    expect(screen.getByText('crawl.ui.noSignals')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'facet:missing-title · 1' }));
    expect(setMetadataFacet).toHaveBeenCalledWith('missing-title');
  });

  it('shows the honest empty metadata state when a facet removes every row', () => {
    render(<CrawlMetadataTab session={{ filteredMetadataRows: [], metadataRows: [{ page: {}, facets: [] }], metadataFacet: 'missing-title', metadataFacetCounts: { all: 1 } as any, localizedFacetLabel: (facet: any) => facet.id, localizedFacetDescription: (facet: any) => facet.id, setMetadataFacet: vi.fn(), t } as any} />);
    expect(screen.getByText('crawl.ui.noUrlsForMetadata')).toBeTruthy();
  });

  it('labels every client redirect mechanism and preserves zero, missing and empty values', () => {
    const redirects = ['meta-refresh', 'http-refresh', 'javascript', 'javascript-inline', 'unknown'].map((source, index) => ({ source, delay_seconds: index === 0 ? null : index === 1 ? undefined : index === 2 ? 0 : index - 1, declaration: `decl-${index}`, target_url: index % 2 ? `https://example.com/target-${index}` : '' }));
    render(<CrawlClientRedirectsSection session={{ result: { pages: [{ url: 'https://example.com/source', client_redirects: redirects }] }, t } as any} />);
    expect(screen.getByText('crawlDeepUi.mechanismMetaRefresh')).toBeTruthy();
    expect(screen.getByText('crawlDeepUi.mechanismHttpRefresh')).toBeTruthy();
    expect(screen.getByText('crawlDeepUi.mechanismJavascript')).toBeTruthy();
    expect(screen.getByText('crawlDeepUi.mechanismJavascriptInline')).toBeTruthy();
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getAllByText('crawlDeepUi.undetermined')).toHaveLength(2);
    expect(screen.getByText('0 s')).toBeTruthy();
    expect(screen.getAllByText('crawlDeepUi.noValidHttpTarget')).toHaveLength(3);
    expect(screen.getByText('https://example.com/target-1')).toBeTruthy();
  });
});
