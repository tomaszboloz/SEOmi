import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuditStore } from '@/stores/auditStore';

vi.mock('@/services/tauri', () => ({
  invokeTauriCommand: vi.fn(),
}));

vi.mock('@/services/storage', () => ({
  readStorage: vi.fn(),
  writeStorage: vi.fn(),
  removeStorage: vi.fn(),
  writeStorageResult: vi.fn(() => ({ ok: true })),
  readJsonStorage: vi.fn(() => []),
  writeJsonStorage: vi.fn(),
  removeJsonStorage: vi.fn(),
}));

describe('auditStoreModules', () => {
  beforeEach(() => {
    useAuditStore.setState({
      currentAudit: null,
      history: [],
      isLoading: false,
      error: null,
      activeTab: 'overview',
      searchFilter: '',
      showOnlyProblems: false,
      selectedUserAgent: 'chrome_mac',
      dataforseoData: null,
      dataforseoSerp: [],
      isDataForSEOLoading: false,
      dataforseoError: null,
      batchItems: [],
      batchRun: null,
      batchRejectedRows: [],
      isBatchRunning: false,
      isBatchStopping: false,
      batchWakeupError: null,
      activeBatchRequestId: null,
    });
  });

  it('should have initial state', () => {
    const state = useAuditStore.getState();
    expect(state.currentAudit).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.activeTab).toBe('overview');
    expect(state.isLoading).toBe(false);
  });

  it('should update search filter', () => {
    useAuditStore.getState().setSearchFilter('test');
    expect(useAuditStore.getState().searchFilter).toBe('test');
  });

  it('should update active tab', () => {
    useAuditStore.getState().setActiveTab('performance');
    expect(useAuditStore.getState().activeTab).toBe('performance');
  });

  it('should set show only problems', () => {
    useAuditStore.getState().setShowOnlyProblems(true);
    expect(useAuditStore.getState().showOnlyProblems).toBe(true);
  });

  it('should set selected user agent', () => {
    useAuditStore.getState().setSelectedUserAgent('googlebot');
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot');
  });

  it('should clear audit', () => {
    useAuditStore.setState({ currentAudit: { url: 'http://test.com' } as any });
    useAuditStore.getState().clearAudit();
    expect(useAuditStore.getState().currentAudit).toBeNull();
  });
});
