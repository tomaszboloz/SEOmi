import { useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import type { CrawlRunRecord } from "@/types";

interface EvidenceRoutingParams {
  activeProjectId: string | null;
  runs: CrawlRunRecord[];
  onSelectRun: (id: string) => void;
  tabNav: {
    activeTab: any;
    setActiveTab: (tab: any) => void;
  };
  filterState: {
    setLinkQuery: (q: any) => void;
    setLinkKind: (k: any) => void;
    setLinkStatus: (s: any) => void;
    setLinkEvidence: (e: any) => void;
    setSeverity: (s: any) => void;
    setErrorKind: (k: any) => void;
    setSegment: (s: any) => void;
    setOnlyProblems: (p: any) => void;
    setQuery: (q: any) => void;
    setEvidenceUrl: (u: any) => void;
    linkEvidence: { source: string; target: string } | null;
  };
  navigationRunId: string;
  pages: unknown[];
}

export const useCrawlEvidenceRouting = ({
  activeProjectId,
  runs,
  onSelectRun,
  tabNav,
  filterState,
  navigationRunId,
  pages,
}: EvidenceRoutingParams) => {
  useEffect(() => {
    const openEvidence = () => {
      const prefix = "#crawl-evidence?";
      if (!window.location.hash.startsWith(prefix)) return;
      const params = new URLSearchParams(window.location.hash.slice(prefix.length));
      const projectId = params.get("project");
      const runId = params.get("run");
      const url = params.get("url");
      const tab = params.get("tab");
      const source = params.get("source");
      const target = params.get("target");
      if (!projectId || !runId || !url) return;
      if (projectId !== activeProjectId) {
        if (useProjectStore.getState().projects.some((project) => project.id === projectId)) {
          useProjectStore.getState().selectProject(projectId);
        }
        return;
      }
      const run = runs.find((candidate) => candidate.id === runId);
      if (!run) return;
      if (tab === "links" && source && target) {
        tabNav.setActiveTab("links");
        filterState.setLinkQuery("");
        filterState.setLinkKind("all");
        filterState.setLinkStatus("all");
        filterState.setLinkEvidence({ source, target });
        onSelectRun(run.id);
        return;
      }
      tabNav.setActiveTab("urls");
      filterState.setSeverity("all");
      filterState.setErrorKind("all");
      filterState.setSegment("all");
      filterState.setOnlyProblems(false);
      filterState.setQuery(url);
      filterState.setEvidenceUrl(url);
      onSelectRun(run.id);
      window.requestAnimationFrame(() => document.getElementById(`crawl-row-${encodeURIComponent(url)}`)?.scrollIntoView?.({ block: "center" }));
    };
    openEvidence();
    window.addEventListener("hashchange", openEvidence);
    return () => window.removeEventListener("hashchange", openEvidence);
  }, [activeProjectId, onSelectRun, runs]);

  useEffect(() => {
    if (tabNav.activeTab !== "links" || !filterState.linkEvidence || typeof window === "undefined") return;
    const scrollToLink = () => {
      const row = Array.from(document.querySelectorAll<HTMLElement>("[data-crawl-link-row]")).find(
        (element) => element.dataset.sourceUrl === filterState.linkEvidence!.source && element.dataset.targetUrl === filterState.linkEvidence!.target
      );
      row?.scrollIntoView?.({ block: "center" });
    };
    const firstFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToLink));
    return () => window.cancelAnimationFrame(firstFrame);
  }, [tabNav.activeTab, filterState.linkEvidence, navigationRunId, pages]);
};
