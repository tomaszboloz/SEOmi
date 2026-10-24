import type { Ga4Report } from '@/types/ga4';
import { dropSnapshot } from './store';

/** Last Google Analytics report per project, kept for the session only (reports are not persisted). */
const reports = new Map<string, Ga4Report>();

/** Remembering a report invalidates the project's shared telemetry so the next read includes it. */
export const rememberGa4Report = (projectId: string, report: Ga4Report): void => {
  reports.set(projectId, report);
  dropSnapshot(projectId);
};

export const recallGa4Report = (projectId: string): Ga4Report | null => reports.get(projectId) ?? null;

export const forgetGa4Reports = (): void => { reports.clear(); };
