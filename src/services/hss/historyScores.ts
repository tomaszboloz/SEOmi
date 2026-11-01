import { loadAllIgosHistory } from '@/services/igos/history';
import { loadAllSijaHistory } from '@/services/sija/history';

/**
 * Latest measured score per phrase. IGOS from different providers/models is not comparable (#68 GEM-68-06),
 * so only runs measured with the model of the newest run are kept.
 */
export const latestIgosScores = (projectId: string | null | undefined): Array<number | null> => {
  const latest = loadAllIgosHistory(projectId ?? null).flatMap((rows) => (rows[0] ? [rows[0]] : []));
  const newest = [...latest].sort((a, b) => b.runAt.localeCompare(a.runAt))[0];
  return newest ? latest.filter((row) => row.provider === newest.provider && row.model === newest.model).map((row) => row.igos) : [];
};

/** Latest SSAS per phrase; inconclusive runs stay null and are skipped, never counted as 0. */
export const latestSijaScores = (projectId: string | null | undefined): Array<number | null> =>
  loadAllSijaHistory(projectId ?? null).flatMap((rows) => (rows[0] ? [rows[0].ssas] : []));
