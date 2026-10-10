import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditHtml, crawlReportHtml, downloadAuditHtml, downloadCrawlHtml } from '@/services/export';
import type { CrawlReportTemplate, ReportTemplateSection } from '@/services/reportTemplates';
import { audit, crawlRun } from './fixtures/export';

const template = (sections: ReportTemplateSection[]): CrawlReportTemplate => ({
  id: 'html-selection', name: 'HTML selection', sections,
  createdAt: '2026-10-01', updatedAt: '2026-10-01',
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('escapes stored audit evidence before placing it in HTML', () => {
  const html = auditHtml({ ...audit, meta_tags: { ...audit.meta_tags, title: '<script>alert(1)</script>' } });
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('Needs \\&quot;quotes\\&quot;');
  expect(html).toContain('Source: saved local snapshot');
});

it('keeps crawl metadata, evidence and the selected section allow-list', () => {
  const html = crawlReportHtml(crawlRun, template(['issues']));
  expect(html).toContain('run-unsafe');
  expect(html).toContain('=issue');
  expect(html).toContain('<h2>issues</h2>');
  expect(html).not.toContain('<h2>pages</h2>');
  expect(html).toContain('Recorded limitations');
});

describe('HTML downloads', () => {
  let clicked: string[];
  beforeEach(() => {
    clicked = [];
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:html');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download); });
  });

  it.each([
    ['audit', () => downloadAuditHtml(audit), /seomi-audit-example.com-2026-09-20\.html$/],
    ['crawl', () => downloadCrawlHtml(crawlRun), /-report\.html$/],
  ])('downloads a %s HTML report', (_, action, filename) => {
    action();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(document.querySelector('a[download]')).toBeNull();
    expect(blob.type).toBe('text/html;charset=utf-8');
    expect(blob.size).toBeGreaterThan(0);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatch(filename);
    vi.runAllTimers();
  });
});
