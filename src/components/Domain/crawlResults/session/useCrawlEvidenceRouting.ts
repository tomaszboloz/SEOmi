import { useEffect, useLayoutEffect, useRef } from "react";
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
  const selectedRun = useRef({ id: navigationRunId, revision: 0 });
  useLayoutEffect(() => {
    if (selectedRun.current.id !== navigationRunId) selectedRun.current = { id: navigationRunId, revision: selectedRun.current.revision + 1 };
  }, [navigationRunId]);
  useEffect(() => {
    let current = true;
    let revision = 0;
    let frame: number | undefined;
    const openEvidence = () => {
      const request = ++revision;
      if (frame !== undefined && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      frame = undefined;
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
      const owner = selectedRun.current;
      onSelectRun(run.id);
      const scrollToRow = () => {
        const selected = selectedRun.current;
        const ownedTransition = selected.revision === owner.revision || (owner.id !== runId && selected.revision === owner.revision + 1);
        if (current && request === revision && selected.id === runId && ownedTransition) {
          document.getElementById(`crawl-row-${encodeURIComponent(url)}`)?.scrollIntoView?.({ block: "center" });
        }
      };
      if (typeof window.requestAnimationFrame === "function") frame = window.requestAnimationFrame(scrollToRow);
      else scrollToRow();
    };
    openEvidence();
    window.addEventListener("hashchange", openEvidence);
    return () => {
      current = false;
      if (frame !== undefined && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openEvidence);
    };
  }, [activeProjectId, onSelectRun, runs]);

  useEffect(() => {
    if (tabNav.activeTab !== "links" || !filterState.linkEvidence || typeof window === "undefined") return;
    let current = true;
    let secondFrame: number | undefined;
    const scrollToLink = () => {
      if (!current) return;
      const row = Array.from(document.querySelectorAll<HTMLElement>("[data-crawl-link-row]")).find(
        (element) => element.dataset.sourceUrl === filterState.linkEvidence!.source && element.dataset.targetUrl === filterState.linkEvidence!.target
      );
      row?.scrollIntoView?.({ block: "center" });
    };
    const firstFrame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(() => {
        if (current) secondFrame = window.requestAnimationFrame(scrollToLink);
      })
      : undefined;
    if (firstFrame === undefined) scrollToLink();
    return () => {
      current = false;
      if (typeof window.cancelAnimationFrame !== "function") return;
      if (firstFrame !== undefined) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) window.cancelAnimationFrame(secondFrame);
    };
  }, [activeProjectId, tabNav.activeTab, filterState.linkEvidence, navigationRunId, pages]);
};
