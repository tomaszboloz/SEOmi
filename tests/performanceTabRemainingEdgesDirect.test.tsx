import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { PerformanceArtifactsSection } from '@/components/Domain/crawlResults/performanceTab/PerformanceArtifactsSection';
import { PerformancePagesTable } from '@/components/Domain/crawlResults/performanceTab/PerformancePagesTable';
import { PerformanceRenderedVitalsTable } from '@/components/Domain/crawlResults/performanceTab/PerformanceRenderedVitalsTable';
import { PerformanceSummaryCards } from '@/components/Domain/crawlResults/performanceTab/PerformanceSummaryCards';
import { createCrawlPageFixture } from './fixtures/crawl';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const artifact = {
  requestedUrl: 'https://example.test/page', finalUrl: 'https://example.test/final',
  capturedAt: '2026-10-01T12:34:56.000Z', artifactType: 'pdf' as const,
  contentType: 'application/pdf', fileName: 'page.pdf', bytes: 2048,
  dataBase64: 'cGRm', rendererPlatform: 'test',
};

describe('crawl performance edge contracts', () => {
  it('renders PDF activity, errors, artifact evidence and routes controls', () => {
    const setUrl = vi.fn();
    const create = vi.fn();
    const view = render(<PerformanceArtifactsSection renderedArtifactUrl="https://example.test"
      renderedArtifactUrls={['https://example.test', 'https://example.test/page']}
      setRenderedArtifactUrl={setUrl} createRenderedArtifact={create} renderedArtifactKind={null}
      renderedArtifactError={null} renderedArtifact={null} t={t} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: artifact.requestedUrl } });
    fireEvent.click(screen.getByRole('button', { name: 'crawlDeepUi.screenshot' }));
    fireEvent.click(screen.getByRole('button', { name: 'crawlDeepUi.pagePdf' }));
    expect(setUrl).toHaveBeenCalledWith(artifact.requestedUrl);
    expect(create).toHaveBeenCalledWith('screenshot');
    expect(create).toHaveBeenCalledWith('pdf');

    view.rerender(<PerformanceArtifactsSection renderedArtifactUrl={artifact.requestedUrl}
      renderedArtifactUrls={[artifact.requestedUrl]} setRenderedArtifactUrl={setUrl}
      createRenderedArtifact={create} renderedArtifactKind="pdf" renderedArtifactError="capture failed"
      renderedArtifact={artifact} t={t} />);
    expect(screen.getByRole('status').textContent).toContain('crawlDeepUi.pagePdf');
    expect(screen.getByRole('alert').textContent).toBe('capture failed');
    expect((screen.getByRole('button', { name: 'crawlDeepUi.pagePdf' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('https://example.test/final')).toBeTruthy();
    const downloadBtn = screen.getByRole('button', { name: 'crawlDeepUi.downloadAgain' });
    expect(downloadBtn).toBeTruthy();
    fireEvent.click(downloadBtn);
  });


  it('renders request errors, transfer bytes and browser navigation headings', () => {
    const pages = [
      createCrawlPageFixture({ url: 'https://example.test/timeout', http_status: 0, request_error_kind: 'timeout', content_length: 2048, content_type: 'text/html' }),
      createCrawlPageFixture({ url: 'https://example.test/unknown', http_status: 0, request_error_kind: null, content_length: null, content_type: null }),
    ];
    render(<PerformancePagesTable pages={pages} crawlMode="browser-rendered" t={t} />);
    expect(screen.getByText('crawlDeepUi.navigation')).toBeTruthy();
    expect(screen.getByText('timeout')).toBeTruthy();
    expect(screen.getByText(/exportUi\.statuses\.bytes/).textContent).toContain('2,048');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('shows null and observed rendered vitals side by side', () => {
    render(<PerformanceRenderedVitalsTable renderedVitalsPages={[
      createCrawlPageFixture({ url: 'https://example.test/missing', rendered_lcp_ms: null, rendered_inp_ms: null, rendered_cls: null }),
      createCrawlPageFixture({ url: 'https://example.test/observed', rendered_lcp_ms: 800, rendered_inp_ms: 120, rendered_cls: 0.123 }),
    ]} t={t} />);
    expect(screen.getAllByText('crawlDeepUi.noEntry')).toHaveLength(2);
    expect(screen.getByText('crawlDeepUi.noInteraction')).toBeTruthy();
    expect(screen.getByText('800 ms')).toBeTruthy();
    expect(screen.getByText('120 ms')).toBeTruthy();
    expect(screen.getByText('0.123')).toBeTruthy();
  });

  it('renders empty browser timing cards with explicit placeholders', () => {
    render(<PerformanceSummaryCards timings={[]} median={undefined} crawlMode="browser-rendered" t={t} />);
    expect(screen.getByText('crawlDeepUi.fastestNavigation')).toBeTruthy();
    expect(screen.getByText('crawlDeepUi.slowestNavigation')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});
