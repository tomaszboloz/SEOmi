import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditHtml,
  crawlReportHtml,
  downloadAuditHtml,
  downloadCrawlHtml,
} from '@/services/export/html';
import * as downloadModule from '@/services/export/download';
import { createAuditFixture } from './fixtures/audit';
import { createCrawlRunFixture } from './fixtures/crawl';

describe('export/html direct contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates auditHtml with and without issues and handles document language fallback', () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = '';

    const audit = createAuditFixture({
      issues: [
        {
          code: 'ISSUE_1',
          severity: 'Critical',
          category: 'MetaTags',
          message: 'Missing title',
          recommendation: 'Add title',
        },
      ],
      meta_tags: undefined,
      headings: undefined,
      images: [],
    });

    const html = auditHtml(audit);
    expect(html).toContain('<!doctype html><html lang="en">');
    expect(html).toContain('Missing title');
    expect(html).toContain('ISSUE_1');

    document.documentElement.lang = 'pl';
    const noIssuesAudit = createAuditFixture({ issues: undefined });
    const plHtml = auditHtml(noIssuesAudit);
    expect(plHtml).toContain('<!doctype html><html lang="pl">');

    document.documentElement.lang = originalLang;
  });

  it('downloads audit HTML via downloadText', () => {
    const spy = vi.spyOn(downloadModule, 'downloadText').mockImplementation(() => {});
    const audit = createAuditFixture();
    downloadAuditHtml(audit);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\.html$/),
      expect.stringContaining('<!doctype html>'),
      'text/html',
    );
  });

  it('generates crawlReportHtml with and without templates and limitations fallback', () => {
    const run = createCrawlRunFixture({
      result: {
        ...createCrawlRunFixture().result,
        timed_out: true,
      },
    });
    // Remove timed_out from run.result to trigger source ?? result fallback
    delete (run.result as unknown as Record<string, unknown>).timed_out;

    const htmlWithoutTemplate = crawlReportHtml(run);
    expect(htmlWithoutTemplate).toContain('<!doctype html>');
    expect(htmlWithoutTemplate).toContain('<h2>Configuration</h2>');

    const template = {
      id: 'template-custom',
      name: 'Custom report',
      description: 'Desc',
      sections: ['summary', 'issues'],
    };
    const htmlWithTemplate = crawlReportHtml(run, template as never);
    expect(htmlWithTemplate).toContain('Custom report');
    expect(htmlWithTemplate).toContain('template-custom');
  });

  it('downloads crawl report HTML via downloadText', () => {
    const spy = vi.spyOn(downloadModule, 'downloadText').mockImplementation(() => {});
    const run = createCrawlRunFixture();
    downloadCrawlHtml(run);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\.html$/),
      expect.stringContaining('<!doctype html>'),
      'text/html',
    );
  });
});
