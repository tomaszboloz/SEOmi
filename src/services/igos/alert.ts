import { monitorScoreDrop, monitorTopSetChange } from '@/services/monitoringAlerts';
import { compareIgosRuns, type IgosHistoryEntry } from './history';

/**
 * #68: alert when IGOS falls between two runs. Only comparable runs count: a model/provider change is a
 * different basis, not a page quality drop (GEM-68-06). A TOP-set change on the same model raises the
 * separate informational TOP-change alert instead of a drop alert.
 * `rows` is the phrase history, newest first.
 */
export const monitorIgosDrop = async (projectId: string | null, phrase: string, rows: IgosHistoryEntry[]): Promise<void> => {
  const [current, previous] = rows;
  if (!projectId || !current || !previous) return;
  const comparison = compareIgosRuns(current, previous);
  if (comparison.kind === 'baseline-changed') {
    await monitorTopSetChange(projectId, previous.docUrls, current.docUrls, `${phrase}-${current.runAt}`, phrase);
    return;
  }
  if (comparison.kind !== 'same-basis') return;
  await monitorScoreDrop(projectId, 'igos', { score: previous.igos }, { score: current.igos }, `${phrase}-${current.runAt}`, undefined, phrase);
};
