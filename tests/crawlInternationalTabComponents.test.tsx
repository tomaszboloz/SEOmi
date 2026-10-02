import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlInternationalTab } from '@/components/Domain/crawlResults/CrawlInternationalTab';
import { CrawlLanguageHreflangSection } from '@/components/Domain/crawlResults/internationalTab/CrawlLanguageHreflangSection';
import { CrawlPaginationSection } from '@/components/Domain/crawlResults/internationalTab/CrawlPaginationSection';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('CrawlInternationalTab modular architecture', () => {
  it('satisfies physical LOC <= 150 across internationalTab files', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlInternationalTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/internationalTab'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders Empty state when no international or pagination signals exist', () => {
    const session = {
      result: {
        pages: [
          {
            url: 'https://example.com/',
            document_language: '',
            hreflangs: [],
            amp_url: '',
            pagination_declaration_count: 0,
            pagination_links: [],
          },
        ],
      },
      t: mockT,
    } as any;

    render(<CrawlInternationalTab session={session} />);
    expect(screen.getByText('crawlDeepUi.noInternationalSignals')).toBeTruthy();
  });

  it('renders CrawlLanguageHreflangSection with hreflangs and amp details', () => {
    const pages = [
      {
        url: 'https://example.com/en',
        document_language: 'en',
        hreflangs: [
          {
            language: 'pl',
            target_url: 'https://example.com/pl',
            target_checked_in_run: true,
            target_http_status: 200,
            reciprocal_in_run: true,
            target_canonical_alignment: 'canonical-to-source',
          },
        ],
        amp_url: 'https://example.com/en/amp',
        amp_target_checked_in_run: true,
        amp_target_http_status: 200,
        amp_target_canonical_alignment: 'canonical-to-source',
      },
    ];

    render(<CrawlLanguageHreflangSection pages={pages as any} t={mockT} />);
    expect(screen.getByText('crawlDeepUi.languageHreflangAmp')).toBeTruthy();
    expect(screen.getByText('https://example.com/en')).toBeTruthy();
    expect(screen.getByText(/pl ·/)).toBeTruthy();
    expect(screen.getByText('https://example.com/en/amp')).toBeTruthy();
  });

  it('renders CrawlPaginationSection with pagination links and query changes', () => {
    const pages = [
      {
        url: 'https://example.com/blog',
        pagination_declaration_count: 2,
        pagination_invalid_declaration_count: 0,
        pagination_canonical_alignment: 'self-canonical',
        pagination_links: [
          {
            relation: 'next',
            target_url: 'https://example.com/blog?page=2',
            checked_in_run: true,
            http_status: 200,
            reciprocal_in_run: true,
            query_parameter_changes: ['page: 1 -> 2'],
          },
        ],
      },
    ];

    render(<CrawlPaginationSection pages={pages as any} t={mockT} />);
    expect(screen.getByText('crawlDeepUi.pagination')).toBeTruthy();
    expect(screen.getByText('https://example.com/blog?page=2')).toBeTruthy();
    expect(screen.getByText('page: 1 -> 2')).toBeTruthy();
  });
});
