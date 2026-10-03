

import type { SemanticMap } from "@/services/semanticMap";
import type { CrawledPageSummary } from "@/types";

import type { CrawlRunRecord } from "@/types";

export interface Props {
  projectId: string | null;
  pages: CrawledPageSummary[];
  graph: SemanticMap;
  runId: string;
  sitemapUrls?: string[];
  runs?: CrawlRunRecord[];
  currentRunId?: string;
}