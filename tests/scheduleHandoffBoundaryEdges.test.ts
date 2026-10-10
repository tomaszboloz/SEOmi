import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { applyScheduledExecution } from '@/services/schedules/handoff';
import { loadScheduledAudits } from '@/services/schedules/persistence';
import type { ScheduledAudit, ScheduledExecutionHandoff } from '@/services/schedules/types';

const storageKey = 'seomi_project_project-a_audit_schedules_v1';
const schedule = (patch: Partial<ScheduledAudit> = {}): ScheduledAudit => ({
  id: 'schedule-a', url: 'https://example.test/', intervalHours: 24, enabled: true,
  status: 'scheduled', createdAt: '2026-10-01T08:00:00Z', nextRunAt: '2026-10-02T08:00:00Z', ...patch,
});
const handoff = (patch: Partial<ScheduledExecutionHandoff> = {}): ScheduledExecutionHandoff => ({
  projectId: 'project-a', scheduleId: 'schedule-a', taskType: 'page-audit',
  startedAt: '2026-10-01T09:00:00Z', completedAt: '2026-10-01T09:01:00Z', succeeded: true,
  nextRunAt: '2026-10-02T09:01:00Z', ...patch,
});

beforeEach(() => localStorage.clear());

describe('scheduled execution handoff boundaries', () => {
  it('ignores invalid projects, foreign handoffs, and unknown schedules', () => {
    localStorage.setItem(storageKey, JSON.stringify([schedule()]));
    expect(applyScheduledExecution('../bad', handoff({ projectId: '../bad' }))).toBeNull();
    expect(applyScheduledExecution('project-a', handoff({ projectId: 'other-project' }))).toBeNull();
    expect(applyScheduledExecution('project-a', handoff({ scheduleId: 'missing' }))).toBeNull();
    expect(loadScheduledAudits('project-a')[0].status).toBe('scheduled');
  });

  it('records a successful enabled handoff and its scheduler warning', () => {
    localStorage.setItem(storageKey, JSON.stringify([schedule()]));
    const result = applyScheduledExecution('project-a', handoff({ schedulerError: 'delayed' }));
    expect(result).toMatchObject({ status: 'completed', lastError: 'delayed', nextRunAt: '2026-10-02T09:01:00Z' });
    expect(result?.runHistory).toEqual([{
      startedAt: '2026-10-01T09:00:00Z', completedAt: '2026-10-01T09:01:00Z', succeeded: true,
    }]);
  });

  it('does not append an already recorded execution', () => {
    const recorded = { startedAt: '2026-10-01T09:00:00Z', completedAt: '2026-10-01T09:01:00Z', succeeded: true };
    localStorage.setItem(storageKey, JSON.stringify([schedule({ runHistory: [recorded] })]));
    const first = applyScheduledExecution('project-a', handoff());
    const second = applyScheduledExecution('project-a', handoff());
    expect(first?.runHistory).toEqual([recorded]);
    expect(second?.runHistory).toEqual([recorded]);
  });

  it('pauses disabled failed schedules and preserves the translated fallback error', () => {
    localStorage.setItem(storageKey, JSON.stringify([schedule({ enabled: false, status: 'paused' })]));
    const result = applyScheduledExecution('project-a', handoff({ succeeded: false }));
    const message = i18n.t('runtimeErrors.schedules.auditFailed');
    expect(result).toMatchObject({ status: 'paused', lastError: message });
    expect(result?.runHistory).toEqual([{
      startedAt: '2026-10-01T09:00:00Z', completedAt: '2026-10-01T09:01:00Z', succeeded: false, error: message,
    }]);
  });
});
