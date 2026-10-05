import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useAuditStore } from '@/stores/auditStore';
import { state } from '@/stores/audit/auditConstants';
import { mockAudit } from './fixtures/auditStoreContracts';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), wakeup: vi.fn() }));
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: mocks.invoke, isTauriEnvironment: vi.fn(() => false) }));
vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));
vi.mock('@/services/scheduleWakeup', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/scheduleWakeup')>()), syncAuditQueueWakeup: mocks.wakeup }));

const P = 'project-a';
const key = (suffix: string) => `seomi_project_${P}_${suffix}`;
const item = (id: string, status: string, url = `https://a.test/${id}`) => ({ id, url, status, updatedAt: '2026-01-01T00:00:00Z' });
const summary = { target: 'example.com', total_backlinks: 5, referring_domains: 2, referring_main_domains: 2, rank: 1, dofollow_backlinks: null, broken_backlinks: 0 };
const run = (status = 'running') => ({ id: 'run-1', status, startedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', P);
  state.activeBatchProjectId = null;
  mocks.invoke.mockReset().mockResolvedValue(undefined);
  mocks.wakeup.mockReset().mockResolvedValue(undefined);
  useAuditStore.setState({ batchItems: [], batchRun: null, batchRejectedRows: [], isBatchRunning: false, isBatchStopping: false, activeBatchRequestId: null, batchWakeupError: null, error: null });
});

describe('clearBatchAudits', () => {
  it('does nothing while a batch is running', () => {
    useAuditStore.setState({ isBatchRunning: true, batchItems: [item('1', 'queued')] as never });
    useAuditStore.getState().clearBatchAudits();
    expect(useAuditStore.getState().batchItems).toHaveLength(1);
  });

  it('clears queue, run, rejected rows and storage, cancelling the wakeup of an existing run', () => {
    localStorage.setItem(key('audit_queue_v1'), '[]');
    useAuditStore.setState({ batchItems: [item('1', 'queued')] as never, batchRun: run('completed') as never, batchRejectedRows: [{ row: 1 }] as never });
    useAuditStore.getState().clearBatchAudits();
    expect(useAuditStore.getState()).toMatchObject({ batchItems: [], batchRun: null, batchRejectedRows: [], isBatchStopping: false, activeBatchRequestId: null });
    expect(localStorage.getItem(key('audit_queue_v1'))).toBeNull();
    expect(mocks.wakeup).toHaveBeenCalledWith(P, 'run-1', false);
  });

  it('skips storage work and wakeup without a project or run, and reports a wakeup failure', async () => {
    localStorage.removeItem('seomi_active_project_v1');
    useAuditStore.setState({ batchItems: [item('1', 'queued')] as never });
    useAuditStore.getState().clearBatchAudits();
    expect(useAuditStore.getState().batchItems).toEqual([]);
    expect(mocks.wakeup).not.toHaveBeenCalled();
    localStorage.setItem('seomi_active_project_v1', P);
    mocks.wakeup.mockRejectedValue(new Error('nope'));
    useAuditStore.setState({ batchRun: run('completed') as never });
    useAuditStore.getState().clearBatchAudits();
    await vi.waitFor(() => expect(useAuditStore.getState().batchWakeupError).toContain('nope'));
  });
});

describe('hydrateProject', () => {
  it('resets everything without a project', () => {
    useAuditStore.setState({ history: [mockAudit], currentAudit: mockAudit, batchItems: [item('1', 'queued')] as never, showOnlyProblems: true });
    useAuditStore.getState().hydrateProject(null);
    expect(useAuditStore.getState()).toMatchObject({ history: [], currentAudit: null, batchItems: [], activeTab: 'overview', showOnlyProblems: false });
  });

  it('migrates the legacy history once and loads view preferences', () => {
    localStorage.setItem('seomi_audit_history', JSON.stringify([mockAudit]));
    localStorage.setItem(key('audit_only_problems_v1'), 'true');
    useAuditStore.getState().hydrateProject(P);
    expect(useAuditStore.getState().history).toHaveLength(1);
    expect(useAuditStore.getState().showOnlyProblems).toBe(true);
    expect(localStorage.getItem('seomi_audit_history')).toBeNull();
    expect(localStorage.getItem('seomi_legacy_history_migrated_v1')).toBe('true');
    localStorage.setItem('seomi_audit_history', JSON.stringify([{ ...mockAudit, url: 'https://other.test' }]));
    useAuditStore.getState().hydrateProject('project-b');
    expect(useAuditStore.getState().history).toEqual([]);
  });

  it('marks an orphaned running batch interrupted and persists it', () => {
    localStorage.setItem(key('audit_queue_v1'), JSON.stringify([item('1', 'running'), item('2', 'queued')]));
    localStorage.setItem(key('audit_queue_run_v1'), JSON.stringify({ ...run(), stopRequested: true }));
    useAuditStore.getState().hydrateProject(P);
    const { batchItems, batchRun, isBatchRunning } = useAuditStore.getState();
    expect(batchItems.map((entry) => entry.status)).toEqual(['interrupted', 'queued']);
    expect(batchItems[0].error).toBe(i18n.t('runtimeErrors.audit.batchInterrupted'));
    expect(batchRun).toMatchObject({ status: 'interrupted', stopRequested: false });
    expect(isBatchRunning).toBe(false);
    expect(JSON.parse(localStorage.getItem(key('audit_queue_run_v1')) || '{}').status).toBe('interrupted');
  });

  it('creates a run record for running items that have none', () => {
    localStorage.setItem(key('audit_queue_v1'), JSON.stringify([item('1', 'running')]));
    useAuditStore.getState().hydrateProject(P);
    expect(useAuditStore.getState().batchRun).toMatchObject({ status: 'interrupted' });
  });

  it('keeps a batch that is genuinely running in this session', () => {
    state.activeBatchProjectId = P;
    localStorage.setItem(key('audit_queue_v1'), JSON.stringify([item('1', 'running')]));
    useAuditStore.getState().hydrateProject(P);
    expect(useAuditStore.getState().batchItems[0].status).toBe('running');
    expect(useAuditStore.getState().isBatchRunning).toBe(true);
  });

  it('restores DataForSEO evidence only when its target matches the latest audit host, ignoring www', () => {
    localStorage.setItem(key('audit_history'), JSON.stringify([{ ...mockAudit, final_url: 'https://www.example.com/' }]));
    localStorage.setItem(key('dataforseo_summary_v1'), JSON.stringify(summary));
    localStorage.setItem(key('dataforseo_summary_v1_target'), 'example.com');
    useAuditStore.getState().hydrateProject(P);
    expect(useAuditStore.getState().dataforseoData).toEqual(summary);
    localStorage.setItem(key('dataforseo_summary_v1_target'), 'other.com');
    useAuditStore.getState().hydrateProject(P);
    expect(useAuditStore.getState().dataforseoData).toBeNull();
    expect(useAuditStore.getState().dataforseoSerp).toEqual([]);
  });
});
