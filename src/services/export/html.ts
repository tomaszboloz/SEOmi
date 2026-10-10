import type { CrawlRunRecord, PageAuditData } from '@/types';
import type { CrawlReportTemplate } from '@/services/reportTemplates';
import { exportText } from './csv';
import { crawlReportPayload } from './crawlReport';
import { downloadText } from './download';
import { crawlFilename, reportFilename } from './filenames';

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const shown = (value: unknown): string => value === undefined || value === null || value === ''
  ? exportText('html.unknown')
  : Array.isArray(value) && value.length === 0 ? exportText('statuses.none') : String(value);

const rows = (items: Array<[string, unknown]>): string => items.map(([label, value]) =>
  `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(shown(value))}</td></tr>`).join('');

const table = (title: string, items: Array<[string, unknown]>): string =>
  `<section><h2>${escapeHtml(title)}</h2><table><tbody>${rows(items)}</tbody></table></section>`;

const jsonBlock = (title: string, value: unknown): string =>
  `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(JSON.stringify(value, null, 2) || shown(value))}</pre></section>`;

const documentHtml = (title: string, source: string, body: string): string => {
  const language = typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en';
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="source" content="${escapeHtml(source)}"><title>${escapeHtml(title)}</title><style>body{font:14px system-ui,sans-serif;line-height:1.45;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#172033}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-bottom:.45rem}section{margin:1.5rem 0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:.45rem;text-align:left;vertical-align:top}th{width:24%;background:#f1f5f9}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8fafc;border:1px solid #cbd5e1;padding:.75rem}small{color:#475569}</style></head><body><h1>${escapeHtml(title)}</h1><p><small>${escapeHtml(source)}</small></p>${body}</body></html>`;
};

export const auditHtml = (audit: PageAuditData): string => {
  const issues = (audit.issues || []).map((issue) => ({
    severity: issue.severity, category: issue.category, code: issue.code,
    message: issue.message, recommendation: issue.recommendation,
  }));
  const summary = table(exportText('html.summary'), [
    [exportText('html.inputUrl'), audit.url], [exportText('labels.auditedUrl'), audit.final_url], [exportText('labels.auditedAt'), audit.timestamp],
    [exportText('html.httpStatus'), audit.http_status], [exportText('html.responseTimeMs'), audit.response_time_ms],
    [exportText('html.healthScore'), audit.health_score], [exportText('html.exportedAt'), new Date().toISOString()],
  ]);
  return documentHtml(exportText('html.auditTitle'), exportText('html.sourceLocal'), `${summary}${jsonBlock(exportText('html.auditEvidence'), {
    title: audit.meta_tags?.title, description: audit.meta_tags?.description, canonical: audit.meta_tags?.canonical,
    h1_count: audit.headings?.h1_count, image_count: audit.images?.length, link_count: audit.links?.total_links,
    security_score: audit.security_headers?.score, redirect_chain: audit.redirect_chain,
  })}${jsonBlock(`${exportText('html.issues')} (${issues.length})`, issues)}`);
};

export const downloadAuditHtml = (audit: PageAuditData): void => downloadText(reportFilename(audit, 'html'), auditHtml(audit), 'text/html');

const crawlLimitations = (result: Record<string, unknown>, source: Record<string, unknown>, run: Record<string, unknown>): Array<[string, unknown]> => [
  ['timed_out', source.timed_out ?? result.timed_out], ['cancelled', source.cancelled ?? result.cancelled],
  ['resource_limit_reached', source.resource_limit_reached ?? result.resource_limit_reached],
  ['storage_pages_truncated', source.storage_pages_truncated ?? result.storage_pages_truncated],
  ['storage_pages_total', source.storage_pages_total ?? result.storage_pages_total],
  ['storage_compacted', run.storage_compacted],
  ['discovery_provenance_truncated', source.discovery_provenance_truncated ?? result.discovery_provenance_truncated],
  ['limit_reasons', source.limit_reasons ?? result.limit_reasons],
];

export const crawlReportHtml = (run: CrawlRunRecord, template?: CrawlReportTemplate): string => {
  const payload = crawlReportPayload(run, template);
  const result = payload.result as Record<string, unknown>;
  const runMeta = payload.run as Record<string, unknown>;
  const metadata = table(exportText('html.summary'), [
    [exportText('html.exportFormat'), payload.export_format], [exportText('html.runId'), runMeta.id], [exportText('html.scope'), runMeta.scope_start_url],
    [exportText('html.environment'), runMeta.environment], [exportText('html.completedAt'), runMeta.completed_at], [exportText('html.exportedAt'), payload.exported_at],
    [exportText('html.reportTemplate'), template?.name || exportText('html.fullSnapshot')],
    [exportText('html.templateId'), template?.id || exportText('html.fullSnapshot')],
    [exportText('html.templateSections'), template?.sections?.join(', ') || exportText('html.fullSnapshot')],
  ]);
  const summary = table(exportText('html.evidence'), [
    [exportText('html.pagesCrawled'), result.pages_crawled], [exportText('html.healthScore'), result.health_score],
    [exportText('html.criticalIssues'), result.critical_count], [exportText('html.warnings'), result.warning_count], [exportText('html.durationMs'), result.duration_ms],
  ]);
  const selected = Object.entries(result).filter(([key]) => !['pages_crawled', 'health_score', 'critical_count', 'warning_count', 'notice_count', 'duration_ms', 'cancelled', 'timed_out', 'resource_limit_reached', 'storage_pages_truncated', 'discovery_provenance_truncated', 'limit_reasons'].includes(key));
  const sections = selected.map(([key, value]) => jsonBlock(key, value)).join('');
  const limits = crawlLimitations(result, run.result as unknown as Record<string, unknown>, runMeta);
  const limitations = table(exportText('html.limitations'), limits);
  const configuration = template ? '' : jsonBlock(exportText('html.configuration'), runMeta.configuration);
  return documentHtml(exportText('html.crawlTitle'), exportText('html.sourceLocal'), `${metadata}${summary}${configuration}${sections}${limitations}`);
};

export const downloadCrawlHtml = (run: CrawlRunRecord, template?: CrawlReportTemplate): void => downloadText(crawlFilename(run, 'report', 'html'), crawlReportHtml(run, template), 'text/html');
