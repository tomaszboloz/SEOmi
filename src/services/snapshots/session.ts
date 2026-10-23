import { CrawlEventLog, type Reducer } from './eventLog';
import { freezeCopy } from './freeze';

export interface SimulationSession<S> {
  /** Immutable graph the simulation operates on; never changes after open. */
  readonly snapshot: Readonly<S>;
  readonly revision: number;
  /** True when the crawl log advanced past this session's revision. */
  isStale(): boolean;
  /** Opens a new session on the latest data; the old one stays untouched. */
  refresh(): SimulationSession<S>;
}

export const openSimulationSession = <S>(
  log: CrawlEventLog, reducer: Reducer<S>, initial: () => S,
): SimulationSession<S> => {
  const revision = log.revision;
  const snapshot = freezeCopy(log.project(reducer, initial, revision));
  return {
    snapshot,
    revision,
    isStale: () => log.revision > revision,
    refresh: () => openSimulationSession(log, reducer, initial),
  };
};
