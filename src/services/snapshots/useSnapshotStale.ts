import { useEffect, useState } from 'react';
import type { CrawlEventLog } from './eventLog';

/** True once the crawl log advanced beyond the revision a session was opened at. */
export const useSnapshotStale = (log: CrawlEventLog, revision: number): boolean => {
  const [stale, setStale] = useState(log.revision > revision);
  useEffect(() => {
    setStale(log.revision > revision);
    return log.subscribe(() => setStale(log.revision > revision));
  }, [log, revision]);
  return stale;
};
