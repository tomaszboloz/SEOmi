import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { CrawlTab, CrawlTabGroup, tabs, tabGroupForTab, CrawlNavigationPreferences } from "../crawlResultsHelpers";

export const useCrawlTabNavigation = (
  initialNavigation: CrawlNavigationPreferences
) => {
  const resultsRef = useRef<HTMLElement>(null);
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<CrawlTab>(initialNavigation.activeTab);
  const [activeTabGroup, setActiveTabGroup] = useState<CrawlTabGroup>(initialNavigation.activeTabGroup);

  useEffect(() => {
    const nextGroup = tabGroupForTab(activeTab);
    setActiveTabGroup((current) => (current === nextGroup ? current : nextGroup));
    const activeButton = document.getElementById(`crawl-tab-${activeTab}`);
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
    activeButton?.scrollIntoView?.({ behavior, block: "nearest", inline: "center" });
  }, [activeTab]);

  const selectTabByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
      setActiveTab(next.id);
      document.getElementById(`crawl-tab-${next.id}`)?.focus();
      scrollTabStrip(event.key === "Home" ? "start" : "end");
      return;
    }
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const next = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    setActiveTab(next.id);
    document.getElementById(`crawl-tab-${next.id}`)?.focus();
  };

  const scrollTabStrip = (direction: "left" | "right" | "start" | "end") => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
    if (direction === "start" || direction === "end") {
      scroller.scrollTo?.({ left: direction === "start" ? 0 : scroller.scrollWidth, behavior });
      return;
    }
    scroller.scrollBy({ left: direction === "left" ? -280 : 280, behavior });
  };

  const scrollResults = (direction: "start" | "end") => {
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
    const scrollContainer = resultsRef.current?.closest<HTMLElement>("main");
    if (scrollContainer?.scrollTo) {
      scrollContainer.scrollTo({ top: direction === "start" ? 0 : scrollContainer.scrollHeight, behavior });
      return;
    }
    if (direction === "start") {
      resultsRef.current?.scrollIntoView?.({ behavior, block: "start" });
    } else {
      resultsRef.current?.lastElementChild?.scrollIntoView?.({ behavior, block: "end" });
    }
  };

  return {
    resultsRef,
    tabScrollerRef,
    activeTab,
    setActiveTab,
    activeTabGroup,
    setActiveTabGroup,
    selectTabByKey,
    scrollTabStrip,
    scrollResults,
  };
};
