import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useAuditStore } from '@/stores/auditStore';
import { mockAudit } from './fixtures/auditStoreContracts';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: vi.fn(() => false) }));
vi.mock('@/services/desktopNotifications', () => ({ notifyAuditCompleted: vi.fn(), notifyBatchCompleted: vi.fn() }));

const PROJECT = 'project-a';
const historyKey = `seomi_project_${PROJECT}_audit_history`;
const audit = (n: number) => ({ ...mockAudit, url: `https://a.test/${n}`, final_url: `https://a.test/${n}`, timestamp: `2026-01-${String(n).padStart(2, '0')}T00:00:00Z` });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  localStorage.setItem('seomi_active_project_v1', PROJECT);
  useAuditStore.setState({ history: [], currentAudit: null, error: null, isLoading: false, activeTab: 'overview', searchFilter: '', showOnlyProblems: false });
});

describe('startAudit without a project', () => {
  it('returns false and reports the missing project without starting a request', async () => {
    localStorage.removeItem('seomi_active_project_v1');
    expect(await useAuditStore.getState().startAudit('https://a.test')).toBe(false);
    expect(useAuditStore.getState().error).toBe(i18n.t('runtimeErrors.audit.projectRequired'));
    expect(useAuditStore.getState().isLoading).toBe(false);
  });
});

describe('importScheduledAuditResult', () => {
  it.each([[null], [undefined], ['text'], [42], [{}], [{ url: 'https://a.test' }], [{ timestamp: 't' }], [{ url: 1, timestamp: 't' }], [{ url: 'u', timestamp: 2 }]])('rejects malformed payload %j', (payload) => {
    expect(useAuditStore.getState().importScheduledAuditResult(payload)).toBe(false);
    expect(useAuditStore.getState().currentAudit).toBeNull();
  });

  it('rejects a valid payload when no project is active', () => {
    localStorage.removeItem('seomi_active_project_v1');
    expect(useAuditStore.getState().importScheduledAuditResult(audit(1))).toBe(false);
  });

  it('stores the result first, deduplicates by timestamp and final URL, and keeps 25 entries', () => {
    const { importScheduledAuditResult } = useAuditStore.getState();
    for (let n = 1; n <= 27; n += 1) expect(importScheduledAuditResult(audit(n))).toBe(true);
    expect(importScheduledAuditResult({ ...audit(5), timestamp: '2027-01-01T00:00:00Z' })).toBe(true);
    const { history, currentAudit } = useAuditStore.getState();
    expect(history).toHaveLength(25);
    expect(history[0].timestamp).toBe('2027-01-01T00:00:00Z');
    expect(history.filter((item) => item.final_url === 'https://a.test/5')).toHaveLength(1);
    expect(currentAudit).toBe(history[0]);
    expect(JSON.parse(localStorage.getItem(historyKey) || '[]')).toHaveLength(25);
  });

  it('does not change the visible state when persistence fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(useAuditStore.getState().importScheduledAuditResult(audit(1))).toBe(false);
    spy.mockRestore();
    expect(useAuditStore.getState().history).toEqual([]);
  });
});

describe('view state setters', () => {
  it('persists the active tab and the problems filter per project', () => {
    useAuditStore.getState().setActiveTab('links' as never);
    useAuditStore.getState().setShowOnlyProblems(true);
    expect(localStorage.getItem(`seomi_project_${PROJECT}_active_tab_v1`)).toBe('links');
    expect(localStorage.getItem(`seomi_project_${PROJECT}_audit_only_problems_v1`)).toBe('true');
    expect(useAuditStore.getState()).toMatchObject({ activeTab: 'links', showOnlyProblems: true });
  });

  it('still updates state when there is no project or storage throws', () => {
    localStorage.removeItem('seomi_active_project_v1');
    useAuditStore.getState().setActiveTab('links' as never);
    useAuditStore.getState().setShowOnlyProblems(true);
    expect(useAuditStore.getState()).toMatchObject({ activeTab: 'links', showOnlyProblems: true });
    localStorage.setItem('seomi_active_project_v1', PROJECT);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => useAuditStore.getState().setActiveTab('meta' as never)).not.toThrow();
    spy.mockRestore();
    expect(useAuditStore.getState().activeTab).toBe('meta');
  });

  it('stores search filter and user agent', () => {
    useAuditStore.getState().setSearchFilter('abc');
    useAuditStore.getState().setSelectedUserAgent('Bot/1');
    expect(useAuditStore.getState()).toMatchObject({ searchFilter: 'abc', selectedUserAgent: 'Bot/1' });
  });
});

describe('clearAudit and removeFromHistory', () => {
  it('clears the current audit and error', () => {
    useAuditStore.setState({ currentAudit: audit(1), error: 'x', isLoading: true });
    useAuditStore.getState().clearAudit();
    expect(useAuditStore.getState()).toMatchObject({ currentAudit: null, error: null, isLoading: false });
  });

  it('removes one entry, persists, and drops the current audit only when it was removed', () => {
    const items = [audit(1), audit(2), audit(3)];
    useAuditStore.setState({ history: items, currentAudit: items[1] });
    useAuditStore.getState().removeFromHistory(0);
    expect(useAuditStore.getState().currentAudit).toBe(items[1]);
    expect(JSON.parse(localStorage.getItem(historyKey) || '[]')).toHaveLength(2);
    useAuditStore.getState().removeFromHistory(0);
    expect(useAuditStore.getState().currentAudit).toBeNull();
    expect(useAuditStore.getState().history).toEqual([items[2]]);
  });

  it('ignores an out-of-range index and works without a project', () => {
    useAuditStore.setState({ history: [audit(1)], currentAudit: audit(1) });
    useAuditStore.getState().removeFromHistory(9);
    expect(useAuditStore.getState().history).toHaveLength(1);
    localStorage.removeItem('seomi_active_project_v1');
    useAuditStore.getState().removeFromHistory(0);
    expect(useAuditStore.getState().history).toEqual([]);
  });
});
