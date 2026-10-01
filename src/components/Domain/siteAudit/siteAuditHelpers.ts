export const formatCrawlElapsed = (elapsedMs: number | undefined): string => {
  const totalSeconds = Math.max(0, Math.floor((elapsedMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const focusCrawlStartForm = (): void => {
  if (typeof window === "undefined") return;
  const focus = () => {
    const form = document.getElementById("site-audit-crawl-form");
    form?.scrollIntoView?.({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    document.getElementById("site-audit-start-url")?.focus();
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focus);
  } else {
    focus();
  }
};
