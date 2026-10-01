import type { CrawlRunRecord } from '@/types';
import type { CrawlReportTemplate } from '@/services/reportTemplates';
import { downloadPdf, downloadText } from './download';
import { crawlFilename } from './filenames';

const filteredCrawlResult = (run: CrawlRunRecord, template?: CrawlReportTemplate): Record<string, unknown> => {
  if (!template) return run.result as unknown as Record<string, unknown>;
  const sections = new Set(template.sections);
  const pages = run.result.pages || [];
  const result = run.result as unknown as Record<string, unknown>;
  const filtered: Record<string, unknown> = {
    start_url: run.result.start_url,
    pages_crawled: run.result.pages_crawled,
    health_score: run.result.health_score,
    critical_count: run.result.critical_count,
    warning_count: run.result.warning_count,
    notice_count: run.result.notice_count,
    duration_ms: run.result.duration_ms,
    cancelled: run.result.cancelled,
    timed_out: run.result.timed_out,
    discovery_provenance_truncated: run.result.discovery_provenance_truncated,
    limit_reasons: run.result.limit_reasons || [],
    resource_limit_reached: run.result.resource_limit_reached,
  };
  if (sections.has('configuration')) filtered.configuration = run.config;
  if (sections.has('pages')) filtered.pages = pages;
  if (sections.has('issues')) {
    filtered.issues = pages.flatMap((page) => page.issues.map((issue) => ({ ...issue, page_url: page.url })));
  }
  if (sections.has('links')) {
    filtered.links = pages.flatMap((page) => page.links.map((link) => ({ ...link, source_url: page.url })));
  }
  if (sections.has('images')) {
    filtered.images = pages.flatMap((page) => page.images.map((image) => ({ ...image, page_url: page.url })));
  }
  if (sections.has('resources')) filtered.resources = run.result.resources || [];
  if (sections.has('frames')) {
    filtered.frames = pages.flatMap((page) => (page.frames || []).map((frame) => ({ ...frame, page_url: page.url })));
  }
  if (sections.has('custom-search')) {
    filtered.custom_search = pages.flatMap((page) => (page.custom_search_results || []).map((search) => ({ ...search, page_url: page.url })));
  }
  if (sections.has('semantic')) {
    filtered.semantic = pages.map((page) => ({
      url: page.url,
      final_url: page.final_url,
      title: page.title,
      semantic_terms: page.semantic_terms || [],
      semantic_excerpts: page.semantic_excerpts || [],
      semantic_links: page.semantic_links || [],
      content_hash: page.content_hash,
      content_simhash: page.content_simhash,
    }));
  }
  // Keep crawl-level evidence that is not a selectable table in the report
  // envelope so consumers can identify the exact source snapshot.
  for (const key of ['robots_txt_status', 'robots_user_agent', 'robots_blocked_count', 'sitemap_status', 'sitemap_urls_discovered', 'sitemap_urls']) {
    if (key in result) filtered[key] = result[key];
  }
  return filtered;
};

export const crawlReportPayload = (run: CrawlRunRecord, template?: CrawlReportTemplate): Record<string, unknown> => ({
  export_format: 'seomi-crawl-v1',
  exported_at: new Date().toISOString(),
  report_template: template ? { id: template.id, name: template.name, sections: template.sections } : undefined,
  run: {
    id: run.id,
    completed_at: run.completedAt,
    scope_start_url: run.startUrl,
    environment: run.environment,
    configuration: run.config,
  },
  result: filteredCrawlResult(run, template),
});

export const downloadCrawlPdf = (run: CrawlRunRecord, template?: CrawlReportTemplate): Promise<void> => downloadPdf('generate_crawl_pdf', {
  run: {
    id: run.id,
    completed_at: run.completedAt,
    scope_start_url: run.startUrl,
    environment: run.environment,
    configuration: run.config,
    // The PDF renderer receives the immutable snapshot and applies the
    // section allow-list itself so a report can include issues/links without
    // exposing an unselected pages table in the document.
    result: run.result,
    report_template_sections: template?.sections || null,
    report_template_name: template?.name || null,
  },
}, crawlFilename(run, 'report', 'pdf'));

export const downloadCrawlJson = (run: CrawlRunRecord, template?: CrawlReportTemplate): void => downloadText(crawlFilename(run, 'report', 'json'), JSON.stringify(crawlReportPayload(run, template), null, 2), 'application/json');
