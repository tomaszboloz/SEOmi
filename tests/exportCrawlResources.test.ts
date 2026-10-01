import { describe, expect, it } from 'vitest';
import { crawlFramesCsv, crawlImagesCsv, crawlResourcesCsv } from '@/services/export';
import { CrawlRunRecord } from '@/types';
import { crawlRun, crawlRunWithResources } from './fixtures/export';

describe('export contracts: resources', () => {
  it('exports image HTTP and byte evidence only when present in the crawl snapshot', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            images: [{ src: 'https://example.com/image.webp', alt: 'Example', lazy_loaded: true, checked_in_run: true, http_status: 206, content_length: 4096, width: 2, height: 3, dimensions_source: 'intrinsic-data-uri' }],
          })),
        },
      } as CrawlRunRecord;
      const output = crawlImagesCsv(run);
  
      expect(output).toContain('Resource checked in run');
      expect(output).toContain('HTTP status');
      expect(output).toContain('Content length bytes');
      expect(output).toContain('Dimensions source');
      expect(output).toContain('intrinsic-data-uri');
      expect(output).toContain('"206"');
      expect(output).toContain('"4096"');
    });

  it('exports resource records and neutralizes spreadsheet formulas', () => {
      const output = crawlResourcesCsv(crawlRunWithResources);
      expect(output).toContain("'=resource.css");
      expect(output).toContain('stylesheet');
      expect(output).toContain('text/css');
      expect(output).toContain('Response headers time ms');
      expect(output).toContain('Provenance status');
      expect(output).toContain('orphaned');
      expect(output).toContain('"17"');
    });

  it('exports static iframe evidence with source attribution and formula-safe values', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page, index) => index === 0 ? {
            ...page,
            frames: [{
              src: '=unsafe-frame', resolved_url: 'https://example.com/embed', title: 'Player',
              loading: 'lazy', sandbox: 'allow-scripts', checked_in_run: true, http_status: 200,
            }],
            frames_truncated: false,
          } : page),
        },
      } as CrawlRunRecord;
      const output = crawlFramesCsv(run);
  
      expect(output).toContain('Source page URL');
      expect(output).toContain("'=unsafe-frame");
      expect(output).toContain('https://example.com/embed');
      expect(output).toContain('"200"');
    });

  it('exports checked srcset candidates with status, bytes, and formula-safe URLs', () => {
      const run = {
        ...crawlRun,
        result: {
          ...crawlRun.result,
          pages: crawlRun.result.pages.map((page) => ({
            ...page,
            images: [{
              src: 'https://example.com/image.webp',
              alt: 'Responsive image',
              srcset: 'https://example.com/image-2.webp 2x',
              lazy_loaded: false,
              checked_in_run: true,
              http_status: 200,
              content_length: 1024,
              srcset_resource_checks: [{
                url: '=https://example.com/image-2.webp',
                checked_in_run: true,
                http_status: 404,
                content_length: 2048,
              }],
              srcset_resource_checks_truncated: false,
            }],
          })),
        },
      } as CrawlRunRecord;
  
      const output = crawlImagesCsv(run);
      expect(output).toContain('Srcset candidate checks');
      expect(output).toContain("'=https://example.com/image-2.webp: 404 (2048 B)");
      expect(output).toContain('Srcset checks truncated');
    });
});
