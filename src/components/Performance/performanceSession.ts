import type { CruxFormFactor, CruxReport, PageSpeedReport, PageSpeedStrategy } from '@/services/pagespeed';
import { readJsonStorage } from '@/services/storage';
import { parseCruxReport, parsePageSpeedReport } from '@/services/performanceContracts';

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
    const value = readJsonStorage(
      storageKey(projectId),
      null,
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptySession(defaultUrl);
    const saved = value as Record<string, unknown>;
    return {
      url: typeof saved.url === "string" ? saved.url : defaultUrl,
      strategy: saved.strategy === "desktop" ? "desktop" : "mobile",
      formFactor: saved.formFactor === "DESKTOP" || saved.formFactor === "TABLET" ? saved.formFactor : "PHONE",
      scope: saved.scope === "origin" ? "origin" : "url",
      pageSpeed: parsePageSpeedReport(saved.pageSpeed),
      crux: parseCruxReport(saved.crux),
    };
  } catch {
    return emptySession(defaultUrl);
  }
};
