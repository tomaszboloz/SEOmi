import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlDirectivesTab } from '@/components/Domain/crawlResults/CrawlDirectivesTab';
import { CrawlClientRedirectsSection } from '@/components/Domain/crawlResults/directivesTab/CrawlClientRedirectsSection';
import { CrawlRobotsDirectivesSection } from '@/components/Domain/crawlResults/directivesTab/CrawlRobotsDirectivesSection';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('CrawlDirectivesTab modular architecture', () => {
  it('satisfies physical LOC <= 150 across directivesTab files', () => {
    const files = [
      'src/components/Domain/crawlResults/CrawlDirectivesTab.tsx',
      ...codeFiles('src/components/Domain/crawlResults/directivesTab'),
    ];
    expect(files.length).toBe(5);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders empty client redirects state and basic robots directives', () => {
    const session = {
      result: {
        crawl_mode: 'http-fast',
        pages: [
          {
            url: 'https://example.com',
            http_status: 200,
            indexability_status: 'Indexable',
            canonical_relation: 'self',
            canonical_declaration_count: 1,
            canonical_targets: [{ url: 'https://example.com', relation: 'self', checked_in_run: true, http_status: 200 }],
            canonical_robots_conflict: false,
            meta_robots: 'index, follow',
            x_robots_tag: '',
            robots_decision: {
              indexability: 'index',
              link_following: 'follow',
              directives: ['index', 'follow'],
              sources: ['meta-robots'],
              response_headers_available: true,
            },
          },
        ],
      },
      t: mockT,
    } as any;

    render(<CrawlDirectivesTab session={session} />);
    expect(screen.getByText('crawlDeepUi.noClientRedirects')).toBeDefined();
    expect(screen.getAllByText('https://example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('crawlDeepUi.notDetected')).toBeDefined();
  });

  it('renders client redirects table when redirects exist', () => {
    const session = {
      result: {
        crawl_mode: 'http-fast',
        pages: [
          {
            url: 'https://example.com/old',
            client_redirects: [
              {
                source: 'meta-refresh',
                delay_seconds: 0,
                declaration: '0; url=/new',
                target_url: 'https://example.com/new',
              },
            ],
          },
        ],
      },
      t: mockT,
    } as any;

    render(<CrawlClientRedirectsSection session={session} />);
    expect(screen.getByText('https://example.com/old')).toBeDefined();
    expect(screen.getByText('0 s')).toBeDefined();
    expect(screen.getByText('0; url=/new')).toBeDefined();
    expect(screen.getByText('https://example.com/new')).toBeDefined();
  });

  it('renders CrawlRobotsDirectivesSection with conflict detected', () => {
    const session = {
      result: {
        crawl_mode: 'browser-rendered',
        pages: [
          {
            url: 'https://example.com/conflict',
            canonical_robots_conflict: true,
            meta_robots: 'noindex',
          },
        ],
      },
      t: mockT,
    } as any;

    render(<CrawlRobotsDirectivesSection session={session} />);
    expect(screen.getByText('https://example.com/conflict')).toBeDefined();
    expect(screen.getByText(/crawlDeepUi\.canonicalNoindex/)).toBeDefined();
  });
});
