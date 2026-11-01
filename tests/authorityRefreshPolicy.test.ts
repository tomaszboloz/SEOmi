import { beforeEach, describe, expect, it } from 'vitest';
import {
  afterAttempt, readRefreshState, refreshDecision, writeRefreshState, REFRESH_BACKOFF_BASE_MS, REFRESH_BACKOFF_MAX_MS,
  REFRESH_BUDGET_ATTEMPTS, REFRESH_BUDGET_WINDOW_MS, REFRESH_COOLDOWN_MS, REFRESH_MAX_FAILURES, type RefreshState,
} from '@/services/topicalAuthorityMonitoring';

const T0 = Date.parse('2026-10-01T00:00:00Z');
const base: RefreshState = { enabled: true, failures: 0, attempts: [] };
beforeEach(() => localStorage.clear());

describe('scheduled reference refresh policy (#61 GEM-61-06)', () => {
  it('is opt-in', () => {
    expect(refreshDecision({ ...base, enabled: false }, T0)).toEqual({ run: false, reason: 'disabled' });
    expect(refreshDecision(base, T0)).toEqual({ run: true });
  });

  it('honours the success cooldown to the millisecond', () => {
    const state = { ...base, lastSuccessAt: T0, attempts: [T0] };
    expect(refreshDecision(state, T0 + REFRESH_COOLDOWN_MS - 1)).toEqual({ run: false, reason: 'cooldown' });
    expect(refreshDecision(state, T0 + REFRESH_COOLDOWN_MS)).toEqual({ run: true });
  });

  it('backs off exponentially after failures and caps the wait', () => {
    const one = { ...base, failures: 1, lastAttemptAt: T0 };
    expect(refreshDecision(one, T0 + REFRESH_BACKOFF_BASE_MS - 1)).toEqual({ run: false, reason: 'backoff' });
    expect(refreshDecision(one, T0 + REFRESH_BACKOFF_BASE_MS)).toEqual({ run: true });
    const two = { ...base, failures: 2, lastAttemptAt: T0 };
    expect(refreshDecision(two, T0 + 2 * REFRESH_BACKOFF_BASE_MS - 1).run).toBe(false);
    expect(refreshDecision(two, T0 + 2 * REFRESH_BACKOFF_BASE_MS).run).toBe(true);
    expect(REFRESH_BACKOFF_MAX_MS).toBeGreaterThanOrEqual(REFRESH_BACKOFF_BASE_MS * 2 ** (REFRESH_MAX_FAILURES - 2));
  });

  it('stops retrying after the failure cap until a cooldown has passed', () => {
    const capped = { ...base, failures: REFRESH_MAX_FAILURES, lastAttemptAt: T0 };
    expect(refreshDecision(capped, T0 + REFRESH_COOLDOWN_MS - 1)).toEqual({ run: false, reason: 'retries-exhausted' });
    expect(refreshDecision(capped, T0 + REFRESH_COOLDOWN_MS)).toEqual({ run: true });
  });

  it('limits attempts inside the rolling budget window', () => {
    const attempts = Array.from({ length: REFRESH_BUDGET_ATTEMPTS }, (_, index) => T0 + index);
    expect(refreshDecision({ ...base, attempts }, T0 + 10 * 24 * 3_600_000)).toEqual({ run: false, reason: 'budget' });
    expect(refreshDecision({ ...base, attempts }, T0 + REFRESH_BUDGET_WINDOW_MS + REFRESH_BUDGET_ATTEMPTS)).toEqual({ run: true });
  });

  it('books attempts and prunes old ones', () => {
    const failed = afterAttempt({ ...base, attempts: [T0 - REFRESH_BUDGET_WINDOW_MS - 1, T0 - 5] }, T0, false);
    expect(failed).toMatchObject({ failures: 1, lastAttemptAt: T0, attempts: [T0 - 5, T0] });
    expect(failed.lastSuccessAt).toBeUndefined();
    expect(afterAttempt(failed, T0 + 1, true)).toMatchObject({ failures: 0, lastSuccessAt: T0 + 1 });
  });

  it('persists per project and ignores malformed storage', () => {
    expect(readRefreshState('p1')).toEqual({ enabled: false, lastSuccessAt: undefined, lastAttemptAt: undefined, failures: 0, attempts: [] });
    expect(writeRefreshState('p1', { ...base, failures: 2, lastAttemptAt: T0, attempts: [T0] })).toBe(true);
    expect(readRefreshState('p1')).toMatchObject({ enabled: true, failures: 2, lastAttemptAt: T0, attempts: [T0] });
    expect(writeRefreshState(null, base)).toBe(false);
    expect(readRefreshState(null).enabled).toBe(false);
    localStorage.setItem('seomi_project_p2_authority_refresh_v1', JSON.stringify({ enabled: 'yes', failures: -4, attempts: [1, 'x', null], lastAttemptAt: 'n' }));
    expect(readRefreshState('p2')).toEqual({ enabled: false, lastSuccessAt: undefined, lastAttemptAt: undefined, failures: 0, attempts: [1] });
  });
});
