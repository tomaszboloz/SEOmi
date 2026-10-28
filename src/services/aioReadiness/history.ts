import { validProjectId } from '@/services/schedules/policy';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { AioProfile, AioReport } from './types';

export const AIO_HISTORY_LIMIT = 200;

export interface AioSnapshot {
  runId: string;
  at: string;
  score: number;
  selfContainment: number;
  spoDensity: number;
  extractability: number;
  scored: number;
  weakPassages: number;
  /** Profile identity is persisted so history is never silently recalculated. */
  profile?: Pick<AioProfile, 'id' | 'algorithmVersion' | 'configHash' | 'language' | 'market'>;
}

export const aioHistoryKey = (projectId: string): string => `seomi_project_${projectId}_aio_readiness_history_v1`;

export const validAioProject = (projectId: string | null | undefined): projectId is string => typeof projectId === 'string' && validProjectId(projectId);

const isSnapshot = (value: unknown): value is AioSnapshot => {
  const item = value as Partial<AioSnapshot> | null;
  return Boolean(item) && typeof item?.runId === 'string' && typeof item.at === 'string' && typeof item.score === 'number';
};

export const readAioHistory = (projectId: string | null | undefined): AioSnapshot[] => {
  if (!validAioProject(projectId)) return [];
  const raw = readJsonStorage(aioHistoryKey(projectId), []);
  return (Array.isArray(raw) ? raw.filter(isSnapshot) : []).slice(-AIO_HISTORY_LIMIT);
};

export const makeAioSnapshot = (report: AioReport, runId: string): AioSnapshot => ({
  runId,
  at: report.generatedAt,
  score: report.score,
  selfContainment: report.selfContainment,
  spoDensity: report.spoDensity,
  extractability: report.extractability,
  scored: report.scoredCount,
  weakPassages: report.weakPassages.length,
  profile: report.profile && {
    id: report.profile.id,
    algorithmVersion: report.profile.algorithmVersion,
    configHash: report.profile.configHash,
    language: report.profile.language,
    market: report.profile.market,
  },
});

/** Appends one snapshot per run id (deduplicated, capped); returns the stored list. */
export const recordAioSnapshot = (projectId: string, report: AioReport, runId: string): { saved: boolean; entries: AioSnapshot[] } => {
  const current = readAioHistory(projectId);
  if (!report.scoredCount || current.some((item) => item.runId === runId)) return { saved: false, entries: current };
  const entries = [...current, makeAioSnapshot(report, runId)].slice(-AIO_HISTORY_LIMIT);
  return { saved: writeJsonStorage(aioHistoryKey(projectId), entries), entries };
};
