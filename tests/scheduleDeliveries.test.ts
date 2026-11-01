import { beforeEach, expect, it, vi } from 'vitest';
import { DELIVERY_HISTORY_LIMIT, isDelivered, markDelivered } from '@/services/schedules/deliveries';
import { reconcileScheduledExecutions } from '@/services/scheduleWakeup';
import { addScheduledAudit, loadScheduledAudits } from '@/services/auditSchedule';
import type { ScheduledExecutionHandoff } from '@/services/schedules/types';

const mocks = vi.hoisted(() => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invokeTauriCommand, isTauriEnvironment: () => true }));
const handoff = (overrides: Partial<ScheduledExecutionHandoff> = {}): ScheduledExecutionHandoff => ({
  projectId: 'project-a', scheduleId: 's', taskType: 'page-audit', startedAt: '2026-10-01T08:00:00Z', completedAt: '2026-10-01T08:01:00Z',
  succeeded: true, nextRunAt: '2026-10-02T08:00:00Z', ...overrides,
});
beforeEach(() => { localStorage.clear(); mocks.invokeTauriCommand.mockReset(); });

it('remembers delivered fingerprints per project, bounded, newest first', () => {
  const first = handoff({ fingerprint: 'f0' });
  expect(isDelivered('project-a', first)).toBe(false);
  expect(markDelivered('project-a', first)).toBe(true);
  expect(isDelivered('project-a', first)).toBe(true);
  expect(isDelivered('project-b', first)).toBe(false);
  for (let i = 1; i <= DELIVERY_HISTORY_LIMIT; i += 1) markDelivered('project-a', handoff({ fingerprint: `f${i}` }));
  expect(isDelivered('project-a', first)).toBe(false);
  expect(isDelivered('project-a', handoff({ fingerprint: `f${DELIVERY_HISTORY_LIMIT}` }))).toBe(true);
  markDelivered('project-a', handoff({ fingerprint: 'f5' }));
  expect(JSON.parse(localStorage.getItem('seomi_project_project-a_schedule_deliveries_v1')!)[0]).toBe('f5');
});

it('ignores handoffs without a fingerprint, invalid projects and corrupt storage', () => {
  expect(markDelivered('project-a', handoff())).toBe(false);
  expect(isDelivered('project-a', handoff())).toBe(false);
  expect(markDelivered('bad id!', handoff({ fingerprint: 'x' }))).toBe(false);
  expect(isDelivered('bad id!', handoff({ fingerprint: 'x' }))).toBe(false);
  localStorage.setItem('seomi_project_project-a_schedule_deliveries_v1', '{"a":1}');
  expect(isDelivered('project-a', handoff({ fingerprint: 'x' }))).toBe(false);
  localStorage.setItem('seomi_project_project-a_schedule_deliveries_v1', '["x",1]');
  expect(isDelivered('project-a', handoff({ fingerprint: 'x' }))).toBe(true);
});

it('reconciles a fingerprinted handoff once even when the native side lists it again', async () => {
  addScheduledAudit('project-a', 'https://example.com/', 24);
  const scheduleId = loadScheduledAudits('project-a')[0].id;
  const delivery = handoff({ scheduleId, fingerprint: 'abc' });
  mocks.invokeTauriCommand.mockResolvedValue([delivery]);
  await expect(reconcileScheduledExecutions('project-a')).resolves.toEqual([delivery]);
  await expect(reconcileScheduledExecutions('project-a')).resolves.toEqual([]);
  expect(loadScheduledAudits('project-a')[0].runHistory).toHaveLength(1);
});
