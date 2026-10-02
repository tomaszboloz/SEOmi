import { captureRenderedArtifact } from "@/services/tauri";
import { downloadCrawlPdf } from "@/services/export";
import { downloadRenderedArtifact } from "../crawlResultsHelpers";
import { copyText } from "@/services/clipboard";
import type { SiteCrawlResult, CrawlRunRecord } from "@/types";

export interface CrawlResultsDependencies {
  captureArtifact: typeof captureRenderedArtifact;
  downloadArtifact: typeof downloadRenderedArtifact;
  exportPdf: typeof downloadCrawlPdf;
  copyText: typeof copyText;
}

export const defaultDependencies: CrawlResultsDependencies = {
  captureArtifact: (...args) => captureRenderedArtifact(...args),
  downloadArtifact: (...args) => downloadRenderedArtifact(...args),
  exportPdf: (...args) => downloadCrawlPdf(...args),
  copyText: (...args) => copyText(...args),
};

export interface BaseSessionProps {
  activeProjectId: string | null;
  navigationRunId: string;
  result: SiteCrawlResult;
  runs: CrawlRunRecord[];
  currentRun?: CrawlRunRecord;
}
