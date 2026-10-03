import type { CrawlRunRecord } from '@/types';
import { csv } from './csv';

export type CrawlExportMetadata = {
  run_id: string;
  completed_at: string;
  scope_start_url: string;
  environment?: string;
  crawl_configuration: string;
};

export const crawlMetadata = (run: CrawlRunRecord): CrawlExportMetadata => ({
  run_id: run.id,
  completed_at: run.completedAt,
  scope_start_url: run.startUrl,
  environment: run.environment,
  crawl_configuration: JSON.stringify(run.config),
});

/**
 * Keep the run envelope visible even when a table has no records.
 * Empty CSV files used to contain only a header, which made it impossible to
 * tell which project scope/configuration produced the export.
 */
export const crawlCsv = (
  headers: string[],
  rows: unknown[][],
  metadata: CrawlExportMetadata,
): string => {
  if (rows.length > 0) return csv([headers, ...rows]);
  const envelope = Array<unknown>(headers.length).fill('');
  envelope[0] = metadata.run_id;
  envelope[1] = metadata.completed_at;
  envelope[2] = metadata.scope_start_url;
  if (headers.length > 3) envelope[3] = metadata.crawl_configuration;
  return csv([headers, envelope]);
};
