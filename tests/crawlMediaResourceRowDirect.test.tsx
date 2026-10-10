import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlMediaResourceRow } from '@/components/Domain/crawlResults/mediaTab/CrawlMediaResourceRow';
import type { CrawlResourceInventoryRow } from '@/services/crawlResources';
import type { CrawledResource } from '@/types';
import i18n from '@/i18n';

const show = (resource: Partial<CrawledResource>, status: CrawlResourceInventoryRow['status'] = 'referenced') => render(
  <table><tbody><CrawlMediaResourceRow row={{ resource: { source_urls: [], url: 'https://example.test/photo', resource_type: 'image', ...resource },
    status, sourceUrls: ['https://example.test/'], knownSourceUrls: status === 'referenced' ? ['https://example.test/'] : [] }}
  t={i18n.t.bind(i18n)} /></tbody></table>,
);

describe('resource row measured versus unavailable evidence', () => {
  it.each(['orphaned', 'partial', 'unknown', 'referenced'] as const)('labels %s provenance with exact source evidence', (status) => {
    show({}, status);
    const provenance = screen.getByText(i18n.t(`crawl.resources.provenance.${status}`));
    expect(provenance.title).toBe(i18n.t('crawl.ui.resourceEvidenceTitle', { sources: 1, matched: status === 'referenced' ? 1 : 0 }));
    expect(screen.getByText(i18n.t('crawlDeepUi.noStatus'))).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
  it.each([200, 404])('renders HTTP status %s and its error classification', (status) => {
    show({ http_status: status, content_type: 'image/png', content_length: 0, response_time_ms: 0,
      intrinsic_width: 20, intrinsic_height: 10 });
    const statusCell = screen.getByText(i18n.t('crawl.ui.httpStatus', { status }));
    expect(statusCell.className).toContain(status >= 400 ? 'text-rose-300' : 'text-emerald-300');
    expect(screen.getByText('0 B')).toBeTruthy();
    expect(screen.getByText('0 ms')).toBeTruthy();
    expect(screen.getByText(`20 × 10 · ${i18n.t('crawlDeepUi.intrinsic')}`)).toBeTruthy();
    expect(screen.getByText('image/png')).toBeTruthy();
  });
  it('shows transport errors without manufacturing an HTTP status', () => {
    show({ request_error_kind: 'timeout', intrinsic_width: 20 });
    expect(screen.getByText('timeout').className).toContain('text-rose-300');
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
  it('uses the observed dimensions source and omits incomplete dimensions', () => {
    const view = show({ intrinsic_width: 20, intrinsic_height: 10, dimensions_source: 'png-header' });
    expect(screen.getByText('20 × 10 · png-header')).toBeTruthy();
    view.unmount();
    show({ intrinsic_width: 0, intrinsic_height: 10 });
    expect(screen.queryByText(/×/)).toBeNull();
  });
});
