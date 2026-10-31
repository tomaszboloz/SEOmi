import { monitorScoreDrop } from '@/services/monitoringAlerts';
import { compareIgosRuns, type IgosHistoryEntry } from './history';

/**
 * #68: alert when IGOS falls between two runs. Only comparable runs count: a model/provider or TOP-set
 * change is a different basis, not a page quality drop, so it never raises an alert (GEM-68-06).
 * `rows` is the phrase history, newest first.
 */
export const monitorIgosDrop = async (projectId: string | null, phrase: string, rows: IgosHistoryEntry[]): Promise<void> => {
  const [current, previous] = rows;
  if (!projectId || !current || !previous) return;
  if (compareIgosRuns(current, previous).kind !== 'same-basis') return;
  await monitorScoreDrop(projectId, 'igos', { score: previous.igos }, { score: current.igos }, `${phrase}-${current.runAt}`, undefined, phrase);
};
