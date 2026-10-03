import { useEffect, type RefObject } from "react";
import { CrawlTab } from "../crawlResultsHelpers";

export const useCrawlMapState = (
  mapNavigationRequest: number,
  setActiveTab: (tab: CrawlTab) => void,
  resultsRef: RefObject<HTMLElement | null>
) => {
  const openMapSection = () => {
    setActiveTab("visualisations");
    const scrollToMap = () => {
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
      const mapSection = document.getElementById("crawl-map-section");
      if (mapSection) {
        mapSection.scrollIntoView?.({ behavior, block: "start" });
        return;
      }
      resultsRef.current?.scrollIntoView?.({ behavior, block: "start" });
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToMap));
    } else {
      scrollToMap();
    }
  };

  useEffect(() => {
    if (mapNavigationRequest === 0) return;
    openMapSection();
  }, [mapNavigationRequest]);

  return { openMapSection };
};
