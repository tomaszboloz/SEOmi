import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { RenderedPageArtifact, SiteCrawlResult, CrawlRunRecord } from "@/types";
import { CrawlResultsDependencies } from "./crawlResultsSessionTypes";

export const useCrawlExportHandlers = (
  result: SiteCrawlResult,
  currentRun: CrawlRunRecord | undefined,
  dependencies: CrawlResultsDependencies
) => {
  const { t } = useTranslation();
  
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [renderedArtifactUrl, setRenderedArtifactUrl] = useState(result.start_url);
  const [renderedArtifact, setRenderedArtifact] = useState<RenderedPageArtifact | null>(null);
  const [renderedArtifactKind, setRenderedArtifactKind] = useState<"screenshot" | "pdf" | null>(null);
  const [renderedArtifactError, setRenderedArtifactError] = useState<string | null>(null);

  useEffect(() => {
    setRenderedArtifactUrl(result.start_url);
    setRenderedArtifact(null);
    setRenderedArtifactKind(null);
    setRenderedArtifactError(null);
    setPdfError(null);
  }, [currentRun?.id, result.start_url]);

  const exportPdf = async () => {
    if (!currentRun) return;
    setPdfError(null);
    try {
      await dependencies.exportPdf(currentRun);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : t("crawl.ui.pdfError"));
    }
  };

  const createRenderedArtifact = async (kind: "screenshot" | "pdf") => {
    if (result.crawl_mode !== "browser-rendered") return;
    setRenderedArtifactKind(kind);
    setRenderedArtifactError(null);
    try {
      const config = currentRun?.config;
      const artifact = await dependencies.captureArtifact({
        url: renderedArtifactUrl,
        allowSubdomains: config?.allowSubdomains ?? false,
        scopePath: config?.scopePath,
        waitForSelector: config?.renderWaitForSelector,
        waitDelayMs: config?.renderWaitDelayMs,
        lazyScrollCycles: config?.renderLazyScrollCycles,
        kind,
        runId: currentRun?.id,
      });
      setRenderedArtifact(artifact);
      dependencies.downloadArtifact(artifact);
    } catch (error) {
      setRenderedArtifactError(
        error instanceof Error ? error.message : t("crawl.ui.renderArtifactError")
      );
    } finally {
      setRenderedArtifactKind(null);
    }
  };

  const renderedArtifactUrls = Array.from(
    new Set(
      [result.start_url, ...result.pages.map((page) => page.final_url || page.url)].filter(Boolean)
    )
  );

  return {
    pdfError,
    setPdfError,
    renderedArtifactUrl,
    setRenderedArtifactUrl,
    renderedArtifact,
    renderedArtifactKind,
    renderedArtifactError,
    renderedArtifactUrls,
    exportPdf,
    createRenderedArtifact,
  };
};
