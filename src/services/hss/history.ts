import { availability, envelope, type ReportEnvelope } from '@/services/analysisContracts';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { HSS_MODULES, type HssModule, type HssReport } from './types';

export const HSS_HISTORY_LIMIT = 50;
export const HSS_HISTORY_MODULE = 'hss';

/** What a stored HSS run keeps: the shown value, coverage and every module value (null = not measured). */
export interface HssSnapshotValue {
  hss: number | null;
  status: HssReport['status'];
  availableWeight: number;
  modules: Record<HssModule, number | null>;
}

/** One HSS run in the shared envelope (#106 item 3, #85): project, run, profile, status and time travel with it. */
export type HssSnapshot = ReportEnvelope<HssSnapshotValue>;

const keyFor = (projectId: string): string => `seomi_project_${projectId}_hss_history_v1`;

const isSnapshot = (value: unknown): value is HssSnapshot => {
  const row = value as Partial<HssSnapshot> | null;
  const payload = row?.value as Partial<HssSnapshotValue> | null | undefined;
  return Boolean(row) && typeof row === 'object' && row!.module === HSS_HISTORY_MODULE && typeof row!.runId === 'string'
    && typeof row!.profileId === 'string' && typeof row!.generatedAt === 'string' && typeof row!.algorithmVersion === 'number'
    && Boolean(payload) && typeof payload!.availableWeight === 'number' && (payload!.hss === null || typeof payload!.hss === 'number')
    && Boolean(payload!.modules) && HSS_MODULES.every((module) => payload!.modules![module] === null || typeof payload!.modules![module] === 'number');
};

/** Saved HSS runs of a project, newest first; damaged rows are dropped, never repaired into numbers. */
export const loadHssHistory = (projectId: string | null | undefined): HssSnapshot[] => {
  if (!projectId) return [];
  const raw = readJsonStorage(keyFor(projectId), []);
  return Array.isArray(raw) ? raw.filter(isSnapshot).slice(0, HSS_HISTORY_LIMIT) : [];
};

/** Insufficient coverage keeps the module values (status partial), but the HSS itself stays null. */
export const hssSnapshot = (projectId: string, report: HssReport, generatedAt: string): HssSnapshot => envelope<HssSnapshotValue>({
  projectId, runId: report.runId, module: HSS_HISTORY_MODULE, algorithmVersion: report.profile.version, profileId: report.profile.id, generatedAt,
  availability: report.status === 'complete' ? availability('complete')
    : report.status === 'unavailable' ? availability('unavailable', 'no-measured-modules', 0)
      : availability('partial', report.status === 'insufficient' ? 'insufficient-coverage' : 'partial-coverage', report.availableWeight),
  value: {
    hss: report.value, status: report.status, availableWeight: report.availableWeight,
    modules: Object.fromEntries(report.components.map((item) => [item.module, item.value])) as Record<HssModule, number | null>,
  },
});

/**
 * Stores one HSS run per crawl run (idempotent: the same run replaces its own row). Unsaved runs and
 * runs with nothing measured are not stored, so a trend never starts from an empty placeholder.
 */
export const recordHssRun = (projectId: string | null | undefined, report: HssReport, generatedAt: string): HssSnapshot[] => {
  if (!projectId || report.runId === 'unsaved' || report.status === 'unavailable') return loadHssHistory(projectId);
  const row = hssSnapshot(projectId, report, generatedAt);
  const rows = [row, ...loadHssHistory(projectId).filter((item) => item.runId !== report.runId)]
    .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : a.generatedAt > b.generatedAt ? -1 : 0))
    .slice(0, HSS_HISTORY_LIMIT);
  return writeJsonStorage(keyFor(projectId), rows) ? rows : loadHssHistory(projectId);
};
