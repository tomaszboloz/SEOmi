import type { CruxFormFactor, CruxReport, PageSpeedReport, PageSpeedStrategy } from '@/services/pagespeed';
import { readJsonStorage } from '@/services/storage';

export interface PerformanceSession {
  url: string;
  strategy: PageSpeedStrategy;
  formFactor: CruxFormFactor;
  scope: "url" | "origin";
  pageSpeed: PageSpeedReport | null;
  crux: CruxReport | null;
}

export const emptySession = (url = ""): PerformanceSession => ({
  url,
  strategy: "mobile",
  formFactor: "PHONE",
  scope: "url",
  pageSpeed: null,
  crux: null,
});
export const storageKey = (projectId: string) =>
  `seomi_pagespeed_workspace_${projectId}`;
export const PSI_METRICS = [
  ["first-contentful-paint", "firstContentfulPaint"],
  ["largest-contentful-paint", "largestContentfulPaint"],
  ["cumulative-layout-shift", "cumulativeLayoutShift"],
  ["total-blocking-time", "totalBlockingTime"],
  ["speed-index", "speedIndex"],
  ["interactive", "timeToInteractive"],
] as const;

export const loadSession = (
  projectId: string | null,
  defaultUrl: string,
): PerformanceSession => {
  if (!projectId) return emptySession(defaultUrl);
  try {
    const saved = readJsonStorage<Partial<PerformanceSession> | null>(
      storageKey(projectId),
      null,
    );
    if (!saved || typeof saved !== "object") return emptySession(defaultUrl);
    return {
      url: typeof saved.url === "string" ? saved.url : defaultUrl,
      strategy: saved.strategy === "desktop" ? "desktop" : "mobile",
      formFactor: ["PHONE", "DESKTOP", "TABLET"].includes(
        saved.formFactor || "",
      )
        ? (saved.formFactor as CruxFormFactor)
        : "PHONE",
      scope: saved.scope === "origin" ? "origin" : "url",
      pageSpeed: saved.pageSpeed || null,
      crux: saved.crux || null,
    };
  } catch {
    return emptySession(defaultUrl);
  }
};

