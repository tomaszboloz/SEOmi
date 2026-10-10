import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCrawlExportHandlers } from '@/components/Domain/crawlResults/session/useCrawlExportHandlers';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import type { CrawlRunRecord } from '@/types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('crawl export handler edge contracts', () => {
  it('skips PDF export without a run and reports non-Error export failures', async () => {
    const exportPdf = vi.fn().mockRejectedValueOnce('pdf failure').mockRejectedValueOnce(new Error('pdf exploded'));
    const deps = { exportPdf, captureArtifact: vi.fn(), downloadArtifact: vi.fn() } as never;
    const result = createCrawlResultFixture();
    const view = renderHook(
      ({ run }: { run: CrawlRunRecord | undefined }) => useCrawlExportHandlers(result, run, deps),
      { initialProps: { run: undefined as CrawlRunRecord | undefined } },
    );
    await act(async () => view.result.current.exportPdf());
    expect(exportPdf).not.toHaveBeenCalled();
    view.rerender({ run: createCrawlRunFixture({ id: 'run-one' }) });
    await act(async () => view.result.current.exportPdf());
    expect(view.result.current.pdfError).toBe('crawl.ui.pdfError');
    view.rerender({ run: createCrawlRunFixture({ id: 'run-two' }) });
    await act(async () => view.result.current.exportPdf());
    expect(view.result.current.pdfError).toBe('pdf exploded');
  });

  it('keeps HTTP runs out of rendered capture and falls back for string capture errors', async () => {
    const captureArtifact = vi.fn().mockRejectedValueOnce('capture failure').mockRejectedValueOnce(new Error('capture exploded'));
    const deps = { exportPdf: vi.fn(), captureArtifact, downloadArtifact: vi.fn() } as never;
    const httpResult = createCrawlResultFixture({ pages: [createCrawlPageFixture({ url: 'https://page.test', final_url: '' })] });
    const httpView = renderHook(() => useCrawlExportHandlers(httpResult, undefined, deps));
    await act(async () => httpView.result.current.createRenderedArtifact('screenshot'));
    expect(captureArtifact).not.toHaveBeenCalled();
    expect(httpView.result.current.renderedArtifactUrls).toContain('https://page.test');

    const browserResult = createCrawlResultFixture({ crawl_mode: 'browser-rendered' });
    const browserView = renderHook(() => useCrawlExportHandlers(browserResult, createCrawlRunFixture({ config: {} as never }), deps));
    await act(async () => browserView.result.current.createRenderedArtifact('pdf'));
    expect(captureArtifact).toHaveBeenCalledWith(expect.objectContaining({ allowSubdomains: false, kind: 'pdf' }));
    expect(browserView.result.current.renderedArtifactError).toBe('crawl.ui.renderArtifactError');
    await act(async () => browserView.result.current.createRenderedArtifact('screenshot'));
    expect(browserView.result.current.renderedArtifactError).toBe('capture exploded');
  });
});
