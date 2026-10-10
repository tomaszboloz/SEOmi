import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlPageTableRow } from '@/components/Domain/crawlResults/pageTable/CrawlPageTableRow';
import { crawlErrorLabel } from '@/services/crawlErrors';
import { createCrawlPageFixture } from './fixtures/crawl';
import type { CrawledPageSummary } from '@/types';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as any;

const show = (
  patch: Partial<CrawledPageSummary> = {},
  evidenceUrl: string | null = null,
  hasRun = true,
  evidenceHref = vi.fn((url: string) => `/evidence?url=${encodeURIComponent(url)}`),
) => {
  const page = createCrawlPageFixture(patch);
  const view = render(
    <table>
      <tbody>
        <CrawlPageTableRow
          page={page}
          evidenceUrl={evidenceUrl}
          evidenceHref={evidenceHref}
          hasRun={hasRun}
          t={t}
        />
      </tbody>
    </table>,
  );
  return { ...view, page, evidenceHref };
};

describe('CrawlPageTableRow direct contracts', () => {
  it('renders selected evidence, links and every populated metric', () => {
    const page = createCrawlPageFixture({
      url: 'https://example.test/a?x=1',
      title: 'Article',
      sentence_count: 4,
      complexity_score: 80,
      complexity_label: 'Complex',
      readability_grade: 7.5,
      readability_method: 'FK',
      readability_ease_score: 72.4,
      readability_label: 'Good',
      discovery_sources: [{ kind: 'sitemap', source_url: 'https://example.test/map' }],
      issues: [{ severity: 'Warning', message: 'Missing description' }],
    });
    const evidenceHref = vi.fn((url: string) => `/evidence/${encodeURIComponent(url)}`);
    const { container } = show(page, page.url, true, evidenceHref);
    const row = container.querySelector('tr')!;
    const link = screen.getByRole('link', { name: /crawl\.ui\.openEvidence/ });

    expect(row.id).toBe(`crawl-row-${encodeURIComponent(page.url)}`);
    expect(row.className).toContain('bg-emerald-500/10');
    expect(link.getAttribute('href')).toBe(`/evidence/${encodeURIComponent(page.url)}`);
    expect(evidenceHref).toHaveBeenCalledWith(page.url);
    expect(screen.getByText('Article')).toBeTruthy();
    expect(screen.getByText('80/100')).toBeTruthy();
    expect(screen.getByText('Complex')).toBeTruthy();
    expect(screen.getByText('72/100')).toBeTruthy();
    expect(screen.getByText('Good')).toBeTruthy();
    expect(row.textContent).toContain('mapUi.discovery.sitemap');
    expect(row.querySelectorAll('td')[10].textContent).toBe('1');
  });

  it('shows transport errors, no-response fallbacks and plain URLs before a run', () => {
    const { container } = show(
      {
        url: 'https://example.test/failure path',
        http_status: 0,
        request_error_kind: 'timeout',
        title: null,
        sentence_count: null,
        complexity_score: null,
        readability_grade: null,
        readability_ease_score: null,
        issues: [],
      },
      null,
      false,
    );
    const row = container.querySelector('tr')!;
    const status = row.querySelector('td span')!;

    expect(status.textContent).toBe(crawlErrorLabel('timeout'));
    expect(status.className).toContain('text-rose-300');
    expect(status.getAttribute('title')).toContain('timeout');
    expect(row.textContent).toContain('(timeout)');
    expect(row.textContent).toContain('—');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('https://example.test/failure path')).toBeTruthy();
  });

  it('marks an HTTP failure when no transport kind is available', () => {
    const { container } = show({ http_status: 404, request_error_kind: null });
    const status = container.querySelector('td span')!;
    expect(status.textContent).toBe('404');
    expect(status.className).toContain('text-rose-300');
    expect(status.getAttribute('title')).toBeNull();
  });
});
