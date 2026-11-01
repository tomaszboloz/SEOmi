import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { authorityRefreshKey, validAuthorityProject } from './keys';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Defaults (owner delegation, #83): one successful SERP refresh per week, at most 4 attempts in 30 days. */
export const REFRESH_COOLDOWN_MS = 7 * DAY_MS;
export const REFRESH_BUDGET_WINDOW_MS = 30 * DAY_MS;
export const REFRESH_BUDGET_ATTEMPTS = 4;
export const REFRESH_BACKOFF_BASE_MS = HOUR_MS;
export const REFRESH_BACKOFF_MAX_MS = DAY_MS;
export const REFRESH_MAX_FAILURES = 3;

export interface RefreshState {
  /** Opt-in: the refresh spends SERP quota (DataForSEO) and crawls competitor pages. Off by default. */
  enabled: boolean;
  lastSuccessAt?: number;
  lastAttemptAt?: number;
  failures: number;
  attempts: number[];
}

export type RefreshSkip = 'disabled' | 'cooldown' | 'backoff' | 'retries-exhausted' | 'budget';
export type RefreshDecision = { run: true } | { run: false; reason: RefreshSkip };

const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

export const readRefreshState = (projectId: string | null | undefined): RefreshState => {
  const raw = (validAuthorityProject(projectId) ? readJsonStorage(authorityRefreshKey(projectId), null) : null) as Record<string, unknown> | null;
  const attempts = Array.isArray(raw?.attempts) ? raw.attempts.filter((item): item is number => num(item) !== undefined) : [];
  return { enabled: raw?.enabled === true, lastSuccessAt: num(raw?.lastSuccessAt), lastAttemptAt: num(raw?.lastAttemptAt), failures: Math.max(0, Math.floor(num(raw?.failures) ?? 0)), attempts };
};

export const writeRefreshState = (projectId: string | null | undefined, state: RefreshState): boolean =>
  validAuthorityProject(projectId) ? writeJsonStorage(authorityRefreshKey(projectId), state) : false;

/** Pure gate: opt-in, success cooldown, exponential retry backoff, retry cap and rolling attempt budget. */
export const refreshDecision = (state: RefreshState, now: number): RefreshDecision => {
  if (!state.enabled) return { run: false, reason: 'disabled' };
  if (state.lastSuccessAt !== undefined && now - state.lastSuccessAt < REFRESH_COOLDOWN_MS) return { run: false, reason: 'cooldown' };
  const recent = state.attempts.filter((at) => now - at < REFRESH_BUDGET_WINDOW_MS);
  if (recent.length >= REFRESH_BUDGET_ATTEMPTS) return { run: false, reason: 'budget' };
  if (state.failures > 0 && state.lastAttemptAt !== undefined) {
    const since = now - state.lastAttemptAt;
    if (state.failures >= REFRESH_MAX_FAILURES) return since < REFRESH_COOLDOWN_MS ? { run: false, reason: 'retries-exhausted' } : { run: true };
    if (since < Math.min(REFRESH_BACKOFF_MAX_MS, REFRESH_BACKOFF_BASE_MS * 2 ** (state.failures - 1))) return { run: false, reason: 'backoff' };
  }
  return { run: true };
};

/** State after an attempt; attempts older than the budget window are dropped so the list stays bounded. */
export const afterAttempt = (state: RefreshState, now: number, ok: boolean): RefreshState => ({
  ...state,
  lastAttemptAt: now,
  ...(ok ? { lastSuccessAt: now } : {}),
  failures: ok ? 0 : state.failures + 1,
  attempts: [...state.attempts.filter((at) => now - at < REFRESH_BUDGET_WINDOW_MS), now],
});
