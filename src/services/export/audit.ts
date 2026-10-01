import type { PageAuditData } from '@/types';
import { escapeCsv, csv, exportHeaders, exportText } from './csv';
import { downloadText, downloadPdf } from './download';
import { reportFilename, auditTableFilename } from './filenames';

export const auditCsv = (audit: PageAuditData): string => {
  const fields = exportHeaders('auditFields');
  const rows = [
    [fields[0], audit.final_url], [fields[1], audit.timestamp], [fields[2], audit.http_status],
    [fields[3], audit.response_time_ms], [fields[4], audit.health_score], [fields[5], audit.meta_tags.title || ''],
    [fields[6], audit.meta_tags.description || ''], [fields[7], audit.meta_tags.canonical || ''],
    [fields[8], audit.headings.h1_count], [fields[9], audit.images.length], [fields[10], audit.links.total_links],
    [fields[11], audit.security_headers.score],
  ];
  const issues = audit.issues.map((issue) => [exportText('labels.issue'), issue.severity, issue.category, issue.message, issue.recommendation || '']);
  return [exportHeaders('auditMain'), ...rows, [], exportHeaders('auditIssues'), ...issues]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');
};

export const downloadAuditJson = (audit: PageAuditData): void => downloadText(reportFilename(audit, 'json'), JSON.stringify(audit, null, 2), 'application/json');
export const downloadAuditCsv = (audit: PageAuditData): void => downloadText(reportFilename(audit, 'csv'), auditCsv(audit), 'text/csv');

export const downloadAuditPdf = (audit: PageAuditData): Promise<void> => downloadPdf('generate_audit_pdf', { audit }, reportFilename(audit, 'pdf'));

export const auditLinksCsv = (audit: PageAuditData): string => {
  const headers = exportHeaders('auditLinks');
  const rows = audit.links.links.map((link) => [
    audit.final_url, audit.timestamp, link.href, link.text, link.is_internal, link.rel || '', link.target || '', link.is_insecure || false,
  ]);
  return csv([headers, ...rows]);
};

export const auditImagesCsv = (audit: PageAuditData): string => {
  const headers = exportHeaders('auditImages');
  const rows = audit.images.map((image) => [
    audit.final_url, audit.timestamp, image.src, image.alt || '', image.has_alt, image.width ?? '', image.height ?? '', image.loading || '', image.srcset || '', image.format || '',
  ]);
  return csv([headers, ...rows]);
};

export const downloadAuditLinksCsv = (audit: PageAuditData): void => downloadText(auditTableFilename(audit, 'links'), auditLinksCsv(audit), 'text/csv');
export const downloadAuditImagesCsv = (audit: PageAuditData): void => downloadText(auditTableFilename(audit, 'images'), auditImagesCsv(audit), 'text/csv');
