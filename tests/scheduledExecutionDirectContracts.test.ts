import { beforeEach, describe, expect, it } from 'vitest';
import { claimDueScheduledAudit, finishScheduledAudit } from '@/services/schedules/execution';
import type { ScheduledAudit } from '@/services/schedules/types';
import i18n from '@/i18n';

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const schedule = (overrides: Partial<ScheduledAudit> = {}): ScheduledAudit => ({
  id: 'schedule-1', url: 'https://example.test/', intervalHours: 6, enabled: true, status: 'scheduled',
  createdAt: new Date(NOW - 60_000).toISOString(), nextRunAt: new Date(NOW - 1).toISOString(), ...overrides,
});
const seed = (projectId: string, schedules: ScheduledAudit[]) => localStorage.setItem(
  `seomi_project_${projectId}_audit_schedules_v1`, JSON.stringify(schedules),
);

describe('scheduled execution direct contracts', () => {
  beforeEach(() => localStorage.clear());

  it('rejects invalid projects, requested mismatches, disabled and future schedules', () => {
    expect(claimDueScheduledAudit('invalid project', NOW)).toBeNull();
    expect(claimDueScheduledAudit('missing-project', NOW)).toBeNull();
    seed('execution-filter', [
      schedule({ id: 'requested', nextRunAt: new Date(NOW + 1).toISOString() }),
      schedule({ id: 'disabled', enabled: false }),
    ]);
    expect(claimDueScheduledAudit('execution-filter', NOW, 'other')).toBeNull();
    expect(claimDueScheduledAudit('execution-filter', NOW, 'requested')).toBeNull();
  });

  it('claims a running schedule with no start timestamp and releases the in-flight guard', () => {
    seed('execution-running', [schedule({ status: 'running', lastStartedAt: undefined })]);
    const claimed = claimDueScheduledAudit('execution-running', NOW);
    expect(claimed).toMatchObject({ status: 'running', lastStartedAt: new Date(NOW).toISOString() });
    expect(claimDueScheduledAudit('execution-running', NOW)).toBeNull();
    expect(finishScheduledAudit('execution-running', 'schedule-1', true, undefined, NOW + 1000)[0])
      .toMatchObject({ status: 'completed', lastError: undefined });
  });

  it('pauses disabled work and records a bounded fallback failure without history gaps', () => {
    seed('execution-finish', [schedule({ enabled: false, status: 'running' }), schedule({ id: 'other' })]);
    const finished = finishScheduledAudit('execution-finish', 'schedule-1', false, undefined, NOW);
    expect(finished[0]).toMatchObject({ status: 'paused', lastError: i18n.t('runtimeErrors.schedules.auditFailed') });
    expect(finished[0].runHistory).toEqual([expect.objectContaining({ succeeded: false, error: i18n.t('runtimeErrors.schedules.auditFailed') })]);
    expect(finished[1]).toMatchObject({ id: 'other', status: 'scheduled', taskType: 'page-audit', runHistory: [] });
  });

  it('truncates explicit failures and keeps only the latest twenty history entries', () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      startedAt: new Date(NOW - index * 1000).toISOString(), completedAt: new Date(NOW - index * 500).toISOString(), succeeded: true,
    }));
    seed('execution-history', [schedule({ runHistory: history })]);
    const error = 'E'.repeat(700);
    const [finished] = finishScheduledAudit('execution-history', 'schedule-1', false, error, NOW);
    expect(finished.status).toBe('failed');
    expect(finished.lastError).toHaveLength(500);
    expect(finished.runHistory).toHaveLength(20);
    expect(finished.runHistory?.at(-1)).toMatchObject({ succeeded: false, error: error.slice(0, 500) });
  });
});
