import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { invokeTauriCommand } from '@/services/tauri';
import { notifyAuditCompleted } from '@/services/desktopNotifications';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => false }));
vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));

const originalAudit = useAuditStore.getState();
const originalProject = useProjectStore.getState();
const project = 'audit-main-remaining';
const historyKey = `seomi_project_${project}_audit_history`;
const originalActive = localStorage.getItem('seomi_active_project_v1');

beforeEach(() => {
  vi.mocked(invokeTauriCommand).mockReset();
  localStorage.setItem('seomi_active_project_v1', project);
  localStorage.removeItem(historyKey);
  useProjectStore.setState({ activeProjectId: project });
  useAuditStore.setState({ currentAudit: null, history: [], isLoading: false, error: null, selectedUserAgent: '' });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useAuditStore.setState(originalAudit, true);
  useProjectStore.setState(originalProject, true);
  localStorage.removeItem(historyKey);
  if (originalActive === null) localStorage.removeItem('seomi_active_project_v1');
  else localStorage.setItem('seomi_active_project_v1', originalActive);
});

describe('single audit fallback and ownership boundaries', () => {
  it('uses configured user agent and recognizes a previous audit by original URL', async () => {
    const old = createAuditFixture({ url: 'https://example.test/start', final_url: 'https://example.test/old', health_score: 20 });
    localStorage.setItem(historyKey, JSON.stringify([old]));
    const result = createAuditFixture({ url: old.url, final_url: 'https://example.test/new', health_score: 90 });
    vi.mocked(invokeTauriCommand).mockResolvedValue(result);
    expect(await useAuditStore.getState().startAudit(old.url)).toBe(true);
    expect(invokeTauriCommand).toHaveBeenCalledWith('inspect_url', expect.objectContaining({
      userAgent: useSettingsStore.getState().config.default_user_agent,
    }));
    expect(notifyAuditCompleted).toHaveBeenCalledWith(project, result, 20);
    expect(useAuditStore.getState().history).toEqual([result, old]);
  });

  it('keeps a completed audit visible while reporting failed history persistence', async () => {
    const result = createAuditFixture();
    vi.mocked(invokeTauriCommand).mockResolvedValue(result);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(await useAuditStore.getState().startAudit(result.url)).toBe(true);
    expect(useAuditStore.getState()).toMatchObject({
      currentAudit: result, isLoading: false, error: i18n.t('runtimeErrors.audit.historySave'),
    });
    expect(localStorage.getItem(historyKey)).toBeNull();
  });

  it('does not overwrite a new project with a stale inspection failure', async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(invokeTauriCommand).mockImplementation(() => new Promise((_, no) => { reject = no; }));
    const pending = useAuditStore.getState().startAudit('https://example.test');
    localStorage.setItem('seomi_active_project_v1', 'new-project');
    const visible = createAuditFixture({ url: 'https://new.test', final_url: 'https://new.test' });
    useAuditStore.setState({ currentAudit: visible, error: 'new project status', isLoading: false });
    reject(new Error('old request failure'));
    expect(await pending).toBe(false);
    expect(useAuditStore.getState()).toMatchObject({ currentAudit: visible, error: 'new project status', isLoading: false });
  });

  it('leaves visible state untouched if project switches during scheduled-result persistence', () => {
    const nativeSetItem = Storage.prototype.setItem;
    const visible = createAuditFixture({ url: 'https://new.test', final_url: 'https://new.test' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      nativeSetItem.call(this, key, value);
      if (key === historyKey) {
        nativeSetItem.call(this, 'seomi_active_project_v1', 'new-project');
        useAuditStore.setState({ currentAudit: visible, history: [visible] });
      }
    });
    const result = createAuditFixture();
    expect(useAuditStore.getState().importScheduledAuditResult(result)).toBe(true);
    expect(JSON.parse(localStorage.getItem(historyKey)!)).toEqual([result]);
    expect(useAuditStore.getState()).toMatchObject({ currentAudit: visible, history: [visible] });
  });
});
