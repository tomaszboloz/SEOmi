

import type { SemanticMap } from "@/services/semanticMap";
import type { TopicalDiagnosisReport } from "@/services/topicalDiagnosis";
import type { CrawledPageSummary } from "@/types";

import type { CrawlRunRecord } from "@/types";

export interface Props {
  projectId: string | null;
  pages: CrawledPageSummary[];
  graph: SemanticMap;
  /** When present, cluster import takes the diagnosis topics instead of raw graph clusters. */
  diagnosis?: TopicalDiagnosisReport;
  runId: string;
  sitemapUrls?: string[];
  runs?: CrawlRunRecord[];
  currentRunId?: string;
}