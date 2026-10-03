import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: robots', () => {
  it('exports the effective per-URL robots decision with sources and header availability', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            meta_robots: 'index, nofollow',
            x_robots_tag: 'googlebot: noindex',
            robots_decision: {
              indexability: 'noindex',
              link_following: 'nofollow',
              directives: ['index', 'nofollow', 'noindex'],
              sources: ['meta robots', 'X-Robots-Tag'],
              response_headers_available: true,
            },
          })),
        },
      } as CrawlRunRecord;

      const output = crawlPagesCsv(run);
      expect(output).toContain('Robots decision');
      expect(output).toContain('noindex; nofollow');
      expect(output).toContain('index, nofollow, noindex');
      expect(output).toContain('meta robots, X-Robots-Tag');
      expect(output).toContain('headers=available');
    });

  it('exports applicable robots rules, sitemap directives and robots-blocked URLs', () => {
      const robotsRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          robots_txt_status: 'Loaded 1 applicable robots.txt rules',
          robots_user_agent: 'SEOmiDesktopBot/1.0',
          robots_applicable_rules: [{ directive: 'disallow', path: '/private' }],
          robots_sitemap_directives: ['https://example.com/sitemap.xml'],
          rejected_urls: [
            { url: 'https://example.com/private/page', reason: 'Blocked by robots.txt Disallow rule: /private' },
            { url: 'https://example.com/outside', reason: 'Outside configured crawl scope' },
          ],
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(robotsRun);

      expect(output).toContain('Applicable robots rules');
      expect(output).toContain('SEOmiDesktopBot/1.0');
      expect(output).toContain('DISALLOW: /private');
      expect(output).toContain('https://example.com/sitemap.xml');
      expect(output).toContain('https://example.com/private/page');
      expect(output).not.toContain('https://example.com/outside');
    });
});
