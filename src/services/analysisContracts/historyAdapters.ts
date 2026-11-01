import { availability, envelope, type Availability, type ReportEnvelope } from './envelope';

/**
 * Incremental migration of module histories onto the shared envelope (#85). The stored snapshots stay
 * untouched (old projects keep loading); these adapters only wrap them on read for export, MCP and PDF.
 * Snapshots saved before a profile was recorded cannot prove how they were scored, so they are `stale`,
 * never `complete`. An unmeasured score is `unavailable` with no value, never 0.
 */
export interface HistoryLike {
  runId: string;
  at: string;
  score?: number | null;
  unavailable?: boolean;
  profile?: string | { id: string; algorithmVersion?: string | number };
  profileId?: string;
}

export type HistoryModule = 'sfs' | 'tas' | 'aio' | 'eetv';

const profileOf = (item: HistoryLike): { id: string | null; version: number } => {
  const { profile } = item;
  if (typeof profile === 'string') return { id: profile.trim() || null, version: 0 };
  if (profile && typeof profile === 'object') {
    const version = Number(profile.algorithmVersion);
    return { id: profile.id, version: Number.isFinite(version) ? version : 0 };
  }
  return { id: item.profileId ?? null, version: 0 };
};

const stateOf = (item: HistoryLike, score: number | null | undefined, profileId: string | null): Availability => {
  if (item.unavailable) return availability('unavailable', 'no-pages-scored', 0);
  if (score === undefined || score === null || !Number.isFinite(score)) return availability('unavailable', 'score-not-finite', 0);
  return profileId ? availability('complete') : availability('stale', 'legacy-no-profile', null);
};

export const historyEnvelope = <T extends HistoryLike>(
  module: HistoryModule, projectId: string, snapshot: T, score: number | null | undefined = snapshot.score,
): ReportEnvelope<T> => {
  const { id, version } = profileOf(snapshot);
  return envelope<T>({
    projectId, runId: snapshot.runId, module, algorithmVersion: version, profileId: id,
    generatedAt: snapshot.at, value: snapshot, availability: stateOf(snapshot, score, id),
  });
};

/** `scoreOf` names the headline number when it is not `score` (TAS stores it as `tas`). */
export const historyEnvelopes = <T extends HistoryLike>(
  module: HistoryModule, projectId: string, snapshots: readonly T[], scoreOf: (item: T) => number | null | undefined = (item) => item.score,
): Array<ReportEnvelope<T>> => snapshots.map((snapshot) => historyEnvelope(module, projectId, snapshot, scoreOf(snapshot)));
