import type { PageAuditData, CrawlRunRecord } from '@/types';

export const reportFilename = (audit: PageAuditData, extension: 'json' | 'csv' | 'pdf' | 'html'): string => {
  const host = new URL(audit.final_url).hostname.replace(/[^a-z0-9.-]/gi, '-');
  const date = audit.timestamp.slice(0, 10);
  return `seomi-audit-${host}-${date}.${extension}`;
};

export const auditTableFilename = (audit: PageAuditData, table: 'links' | 'images'): string => {
  const host = new URL(audit.final_url).hostname.replace(/[^a-z0-9.-]/gi, '-');
  const date = audit.timestamp.replace(/[^0-9]/g, '').slice(0, 14);
  return `seomi-audit-${host}-${date}-${table}.csv`;
};

export const crawlFilename = (run: CrawlRunRecord, table: string, extension: 'json' | 'csv' | 'pdf' | 'html'): string => {
  let host = 'crawl';
  try { host = new URL(run.startUrl).hostname.replace(/[^a-z0-9.-]/gi, '-') || host; } catch {}
  const timestamp = run.completedAt.replace(/[^0-9]/g, '').slice(0, 14) || run.id.replace(/[^a-z0-9]/gi, '').slice(0, 14);
  return `seomi-crawl-${host}-${timestamp}-${table}.${extension}`;
};
