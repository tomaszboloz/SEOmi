import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { CrawlLinksTable } from '@/components/Domain/crawlResults/linksTab/CrawlLinksTable';

const t = ((key: string) => key) as unknown as TFunction;

describe('CrawlLinksTable direct contracts', () => {
  it('shows the empty state without creating a table', () => {
    const { container } = render(
      <CrawlLinksTable
        links={[]}
        linkEvidenceHref={vi.fn()}
        copiedLinkSourceKey={null}
        copyLinkSource={vi.fn().mockResolvedValue(undefined)}
        t={t}
      />,
    );

    expect(screen.getByText('crawl.ui.noLinks')).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });

  it('renders evidence, status details, source copying, and sparse link fallbacks', () => {
    const copyLinkSource = vi.fn().mockResolvedValue(undefined);
    const linkEvidenceHref = vi.fn((source: string, target: string) =>
      `/evidence?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`,
    );
    const sourceUrl = 'https://example.test/source';
    const targetUrl = 'https://other.test/target';
    const sparseUrl = 'https://example.test/sparse';

    render(
      <CrawlLinksTable
        links={[
          {
            sourceUrl,
            key: 'rich-link',
            link: {
              target_url: targetUrl,
              anchor_text: 'Read docs',
              rel: 'nofollow',
              is_internal: true,
              source_excerpt: '<a href="/docs">Read docs</a>',
              target_http_status: 404,
              target_redirect_url: 'https://other.test/moved',
              target_response_time_ms: 321,
              target_checked_at: '2026-10-05T10:00:00Z',
            },
          },
          {
            sourceUrl: sparseUrl,
            key: 'sparse-link',
            link: {
              target_url: 'https://blocked.test/private',
              anchor_text: '',
              is_internal: false,
              target_request_error_kind: 'blocked',
            },
          },
        ]}
        linkEvidence={{ source: sourceUrl, target: targetUrl }}
        linkEvidenceHref={linkEvidenceHref}
        copiedLinkSourceKey={null}
        copyLinkSource={copyLinkSource}
        t={t}
      />,
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(linkEvidenceHref).toHaveBeenNthCalledWith(1, sourceUrl, targetUrl);
    expect(linkEvidenceHref).toHaveBeenNthCalledWith(2, sparseUrl, 'https://blocked.test/private');

    const rows = screen.getAllByRole('row');
    const richRow = rows[1];
    const sparseRow = rows[2];
    expect(richRow.className).toContain('bg-emerald-500/10');
    expect(richRow.className).toContain('text-slate-300');
    expect(within(richRow).getByText('https://example.test/source')).toBeTruthy();
    expect(within(richRow).getByText('Read docs')).toBeTruthy();
    expect(within(richRow).getByText('crawl.ui.internal')).toBeTruthy();
    expect(richRow.querySelector('[title="https://other.test/moved"]')?.textContent).toContain('https://other.test/moved');
    expect(within(richRow).getByText('321 performance.milliseconds')).toBeTruthy();
    expect(within(richRow).getByText('crawl.ui.copyCode')).toBeTruthy();
    expect(within(richRow).getByRole('link').getAttribute('href')).toBe(
      '/evidence?source=https%3A%2F%2Fexample.test%2Fsource&target=https%3A%2F%2Fother.test%2Ftarget',
    );
    fireEvent.click(within(richRow).getByRole('button', { name: 'crawl.ui.copyCode' }));
    expect(copyLinkSource).toHaveBeenCalledWith('rich-link', '<a href="/docs">Read docs</a>');

    expect(sparseRow.className).not.toContain('bg-emerald-500/10');
    expect(within(sparseRow).getByText('crawl.ui.external')).toBeTruthy();
    expect(within(sparseRow).getByText('crawl.ui.blockedPrivateAddress')).toBeTruthy();
    expect(within(sparseRow).getAllByText('—')).toHaveLength(2);
    expect(within(sparseRow).getByText('crawl.ui.noExcerptOlderRun')).toBeTruthy();
  });

  it('labels an already copied source', () => {
    render(
      <CrawlLinksTable
        links={[{
          sourceUrl: 'https://example.test/',
          key: 'copied',
          link: { target_url: 'https://example.test/next', anchor_text: 'Next', is_internal: true, source_excerpt: '<a>Next</a>' },
        }]}
        linkEvidenceHref={() => '#evidence'}
        copiedLinkSourceKey="copied"
        copyLinkSource={vi.fn().mockResolvedValue(undefined)}
        t={t}
      />,
    );

    expect(screen.getByRole('button', { name: 'crawl.ui.copied' })).toBeTruthy();
  });
});
