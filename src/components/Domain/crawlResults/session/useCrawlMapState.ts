import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useAsyncOperationScope } from "@/hooks/useAsyncOperationScope";
import { CrawlTab } from "../crawlResultsHelpers";

export const useCrawlMapState = (
  mapNavigationRequest: number,
  setActiveTab: (tab: CrawlTab) => void,
  resultsRef: RefObject<HTMLElement | null>,
  ownerKey: string | null = null
) => {
  const beginOperation = useAsyncOperationScope(ownerKey);
  const pendingFrames = useRef(new Set<number>());
  const cancelFrames = useCallback(() => {
    if (typeof window.cancelAnimationFrame === "function") {
      pendingFrames.current.forEach((frame) => window.cancelAnimationFrame(frame));
    }
    pendingFrames.current.clear();
  }, []);
  const openMapSection = useCallback(() => {
    cancelFrames();
    const isCurrent = beginOperation("map-navigation");
    setActiveTab("visualisations");
    const scrollToMap = () => {
      if (!isCurrent()) return;
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
      const mapSection = document.getElementById("crawl-map-section");
      if (mapSection) {
        mapSection.scrollIntoView?.({ behavior, block: "start" });
        return;
      }
      resultsRef.current?.scrollIntoView?.({ behavior, block: "start" });
    };
    if (typeof window.requestAnimationFrame === "function") {
      const firstFrame = window.requestAnimationFrame(() => {
        pendingFrames.current.delete(firstFrame);
        if (!isCurrent()) return;
        const secondFrame = window.requestAnimationFrame(() => {
          pendingFrames.current.delete(secondFrame);
          scrollToMap();
        });
        pendingFrames.current.add(secondFrame);
      });
      pendingFrames.current.add(firstFrame);
    } else {
      scrollToMap();
    }
  }, [beginOperation, cancelFrames, resultsRef, setActiveTab]);

  useEffect(() => {
    if (mapNavigationRequest !== 0) openMapSection();
    return () => {
      beginOperation("map-navigation");
      cancelFrames();
    };
  }, [mapNavigationRequest, openMapSection, beginOperation, cancelFrames]);

  return { openMapSection };
};
