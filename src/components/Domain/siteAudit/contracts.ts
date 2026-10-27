import type { invokeTauriCommand } from '@/services/tauri';
import type { importUrlsFromCsv } from '@/services/csvUrls';
import type { compareCrawlResults } from '@/services/crawlDiff';
import type { compareCrawlRuns } from '@/services/crawlDiff';
import type { downloadCrawlPdf } from '@/services/export';

export interface SiteAuditSessionDependencies {
  invoke: typeof invokeTauriCommand;
  importUrls: typeof importUrlsFromCsv;
  compare: typeof compareCrawlResults;
  compareRuns?: typeof compareCrawlRuns;
  downloadPdf: typeof downloadCrawlPdf;
}
