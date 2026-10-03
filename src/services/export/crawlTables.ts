import type { CrawlRunRecord } from '@/types';
import { buildCrawlResourceInventory } from '@/services/crawlResources';
import { exportHeaders, exportText } from './csv';
import { crawlMetadata, crawlCsv } from './crawlMetadata';

export const crawlLinksCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlLinks');
  const rows = run.result.pages.flatMap((page) => page.links.map((link) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, page.final_url, link.target_url, link.target_http_status ?? '', link.target_response_time_ms ?? '',
    link.target_redirect_url || '', link.target_request_error_kind || '', link.target_checked_at || '',
    link.anchor_text, link.rel || '', link.is_internal, link.source_excerpt || '',
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const crawlImagesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlImages');
  const rows = run.result.pages.flatMap((page) => page.images.map((image) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, page.final_url, image.src, image.checked_in_run ?? '', image.http_status ?? '', image.request_error_kind || '', image.content_length ?? '', image.alt || '', image.srcset || '',
    (image.srcset_resource_checks || []).map((candidate) => `${candidate.url}: ${candidate.checked_in_run ? candidate.http_status ?? candidate.request_error_kind ?? exportText('statuses.checked') : exportText('statuses.notChecked')}${candidate.content_length == null ? '' : ` (${candidate.content_length} B)`}`).join(' | '),
    image.srcset_resource_checks_truncated ?? '', image.format || '', image.width ?? '', image.height ?? '', image.dimensions_source || '', image.lazy_loaded,
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const crawlCustomSearchCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const searches = run.config.customSearches || [];
  const headers = exportHeaders('crawlCustomSearch');
  const rows = run.result.pages.flatMap((page) => searches.flatMap((search) => {
    const result = page.custom_search_results?.find((item) => item.id === search.id);
    if (!result) return [[metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', '', '', exportText('statuses.noSavedResult')]];
    if (result.error) return [[metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', '', '', result.error]];
    if (result.values.length === 0) return [[metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', '', '', exportText('statuses.noMatch')]];
    return result.values.map((value, index) => [metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration, page.url, page.final_url, search.name, search.selectorType, search.query, search.resultType, search.attribute || '', index + 1, value, result.truncated ? exportText('statuses.limitedResult') : 'OK']);
  }));
  return crawlCsv(headers, rows, metadata);
};

export const crawlResourcesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlResources');
  const rows = buildCrawlResourceInventory(run.result).map(({ resource, sourceUrls, knownSourceUrls, status }) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    resource.url, resource.resource_type, sourceUrls.join(' | '), knownSourceUrls.join(' | '), status, resource.http_status ?? '', resource.content_type || '', resource.content_length ?? '', resource.intrinsic_width ?? '', resource.intrinsic_height ?? '', resource.dimensions_source || '', resource.response_time_ms ?? '', resource.request_error_kind || '',
  ]);
  return crawlCsv(headers, rows, metadata);
};

export const crawlFramesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlFrames');
  const rows = run.result.pages.flatMap((page) => (page.frames || []).map((frame) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, frame.src || '', frame.resolved_url || '', frame.title || '', frame.name || '', frame.loading || '', frame.sandbox ?? '',
    frame.checked_in_run ?? false, frame.http_status ?? '', frame.request_error_kind || '', page.frames_truncated ?? false,
  ]));
  return crawlCsv(headers, rows, metadata);
};

export const crawlIssuesCsv = (run: CrawlRunRecord): string => {
  const metadata = crawlMetadata(run);
  const headers = exportHeaders('crawlIssues');
  const rows = run.result.pages.flatMap((page) => page.issues.map((issue) => [
    metadata.run_id, metadata.completed_at, metadata.scope_start_url, metadata.crawl_configuration,
    page.url, page.final_url, issue.severity, issue.message,
  ]));
  return crawlCsv(headers, rows, metadata);
};
