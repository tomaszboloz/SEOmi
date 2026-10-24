import type { Ga4Report } from '@/types/ga4';
import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { ga4ReportSchema, MAX_STORED_GA4_ROWS } from './ga4ReportSchema';
import { dropSnapshot } from './store';

const reports = new Map<string, Ga4Report>();
const knownProjects = new Set<string>();
export const ga4ReportStorageKey = (projectId: string): string => `seomi_project_${projectId}_ga4_last_report_v1`;

/** Remembering a report invalidates the project's shared telemetry so the next read includes it. */
export const rememberGa4Report = (projectId: string, report: Ga4Report): void => {
  knownProjects.add(projectId);
  reports.set(projectId, report);
  writeJsonStorage(ga4ReportStorageKey(projectId), {
    ...report,
    rows: report.rows.slice(0, MAX_STORED_GA4_ROWS),
    may_be_truncated: report.may_be_truncated || report.rows.length > MAX_STORED_GA4_ROWS,
  });
  dropSnapshot(projectId);
};

export const recallGa4Report = (projectId: string): Ga4Report | null => {
  knownProjects.add(projectId);
  const cached = reports.get(projectId);
  if (cached) return cached;
  const key = ga4ReportStorageKey(projectId);
  const result = ga4ReportSchema.safeParse(readJsonStorage(key, null));
  if (result.success) {
    reports.set(projectId, result.data);
    return result.data;
  }
  removeStorage(key);
  return null;
};

export const forgetGa4Report = (projectId: string): void => {
  reports.delete(projectId);
  knownProjects.delete(projectId);
  removeStorage(ga4ReportStorageKey(projectId));
  dropSnapshot(projectId);
};

export const forgetGa4Reports = (): void => {
  for (const projectId of knownProjects) forgetGa4Report(projectId);
};
