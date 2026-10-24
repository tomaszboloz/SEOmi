import { beforeEach, expect, it, vi } from 'vitest';
import type { ScheduledAudit } from '@/services/schedules/types';
import type { AuditEntry } from '@/services/team/auditLog';
import { exportAuditCsv } from '@/services/team/auditLog';
import { tasksKey } from '@/services/optimizationTasks/storage';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { verifyTask } from '@/services/optimizationTasks/verify';
import { finishScheduledAudit } from '@/services/schedules/execution';
import { createCrawlPageFixture } from './fixtures/crawl';

const scheduler = vi.hoisted(() => {
  const state: { schedules: ScheduledAudit[] } = { schedules: [] };
  return {
    state,
    load: vi.fn(() => state.schedules),
    save: vi.fn((_projectId: string, schedules: ScheduledAudit[]) => { state.schedules = schedules; }),
  };
});
vi.mock('@/services/schedules/persistence', () => ({ loadScheduledAudits: scheduler.load, saveScheduledAudits: scheduler.save }));
vi.mock('@/services/siteFocus', () => ({ buildSiteFocusReport: () => ({ score: 0, unavailable: true }) }));
vi.mock('@/services/topicalAuthority', () => ({ buildAuthorityReport: () => ({ tas: 0 }) }));

beforeEach(() => {
  localStorage.clear();
  scheduler.state.schedules = [];
  scheduler.load.mockClear();
  scheduler.save.mockClear();
});

it('records a null score delta when site focus is unavailable', () => {
  localStorage.setItem(tasksKey('verify-unavailable'), JSON.stringify([{
    id: 't', kind: 'remove-410', module: 'sfs', status: 'implemented', url: 'https://site.test/gone',
    baselineScore: 50, priority: 'high', createdAt: 'now',
  }]));
  const run = { result: { start_url: 'https://site.test/', pages: [createCrawlPageFixture({ url: 'https://site.test/gone', http_status: 410 })] } } as never;
  expect(runTaskVerification('verify-unavailable', run)[0]).toMatchObject({ status: 'verified', verdict: { delta: null } });
});

it('handles an add-link task without a target URL when a link row exists', () => {
  const page = createCrawlPageFixture({ links: [{ target_url: 'https://site.test/other', anchor_text: 'other', is_internal: true }] });
  expect(verifyTask({ id: 'link', kind: 'add-link', module: 'sfs', status: 'implemented', url: page.url, baselineScore: null, priority: 'low', createdAt: 'now' }, [page], null))
    .toMatchObject({ status: 'failed', code: 'link-missing' });
});

it('creates execution history when an older schedule has no history field', () => {
  scheduler.state.schedules = [{ id: 'legacy', url: 'https://site.test/', intervalHours: 6, enabled: true, status: 'running', createdAt: '2026-10-01T00:00:00Z', nextRunAt: '2026-10-02T00:00:00Z' }];
  const [finished] = finishScheduledAudit('schedule-followup', 'legacy', true, undefined, Date.UTC(2026, 9, 2));
  expect(finished.runHistory).toHaveLength(1);
  expect(finished.runHistory?.[0].succeeded).toBe(true);
});

it('escapes ordinary, special and absent audit CSV cells safely', () => {
  const entry = {
    seq: 1, id: undefined, at: '2026-10-01', actor: '=formula', role: 'developer', action: 'a,b', projectId: 'p', result: 'success',
    metadata: { note: 'plain', formula: '=SUM(A1)' }, prevHash: '', hash: '',
  } as unknown as AuditEntry;
  const csv = exportAuditCsv([entry]);
  expect(csv).toContain("'=formula");
  expect(csv).toContain('"a,b"');
  expect(csv).toContain('plain');
});
