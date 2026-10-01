import { describe, expect, it } from 'vitest';
import { crawlPagesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun } from './fixtures/export';

describe('export contracts: social', () => {
  it('exports favicon and declared social-image checks without manufacturing missing status', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            favicons: ['https://example.com/favicon.ico'],
            favicon_resource_checks: [{
              url: 'https://example.com/favicon.ico', checked_in_run: true, http_status: 200,
              content_type: 'image/x-icon', content_length: 321,
            }],
            social_meta_tags: [
              {
                key: 'og:image', content: 'https://example.com/social.jpg',
                resource_check: {
                  url: 'https://example.com/social.jpg', checked_in_run: true, http_status: 404,
                  content_type: 'text/html', content_length: 82,
                },
              },
              {
                key: 'twitter:image', content: 'https://cdn.example.net/card.jpg',
                resource_check: { url: 'https://cdn.example.net/card.jpg', checked_in_run: false },
              },
            ],
          })),
        },
      } as CrawlRunRecord;
  
      const output = crawlPagesCsv(run);
      expect(output).toContain('Favicon URLs / status / bytes');
      expect(output).toContain('https://example.com/favicon.ico [HTTP 200; 321 B; image/x-icon]');
      expect(output).toContain('og:image: https://example.com/social.jpg [HTTP 404; 82 B; text/html]');
      expect(output).toContain('twitter:image: https://cdn.example.net/card.jpg [not checked in this run]');
    });

  it('exports raw social metadata and favicons from the saved crawl snapshot', () => {
      const metadataRun = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            favicons: ['=https://example.com/icon.svg'],
            favicon_metadata: [{
              href: '=https://example.com/icon.svg',
              rel: 'icon',
              declared_type: 'image/svg+xml',
              declared_sizes: 'any',
              inferred_format: 'svg',
            }],
            social_meta_tags: [
              { key: 'og:title', content: '=unsafe title' },
              { key: 'twitter:card', content: 'summary_large_image' },
            ],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlPagesCsv(metadataRun);
  
      expect(output).toContain('Favicon URLs');
      expect(output).toContain('Favicon declarations');
      expect(output).toContain('rel=icon; type=image/svg+xml; sizes=any; format=svg');
      expect(output).toContain('Open Graph declarations');
      expect(output).toContain('Twitter Card declarations');
      expect(output).toContain("'=https://example.com/icon.svg");
      expect(output).toContain('og:title: =unsafe title');
      expect(output).toContain('twitter:card: summary_large_image');
    });
});
