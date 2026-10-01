import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudit } from '@/hooks/useAudit';
import { useAuditStore } from '@/stores/auditStore';

const initial = useAuditStore.getState();
afterEach(() => useAuditStore.setState(initial));

describe('public audit hook subscription', () => {
  it('reacts to audit status, error and tab changes while preserving the store action identities', () => {
    useAuditStore.setState({ currentAudit: null, isLoading: false, error: null, activeTab: 'overview', history: [] });
    const { result } = renderHook(() => useAudit());
    expect(result.current.audit).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.history).toEqual([]);
    expect(result.current.startAudit).toBe(initial.startAudit);
    expect(result.current.clearAudit).toBe(initial.clearAudit);
    act(() => useAuditStore.setState({ isLoading: true, error: 'provider unavailable' }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe('provider unavailable');
    act(() => result.current.setActiveTab('security'));
    expect(result.current.activeTab).toBe('security');
    act(() => result.current.clearAudit());
    expect(result.current.audit).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('forwards the caller request through the store action without a second transport', async () => {
    const startAudit = vi.fn().mockResolvedValue(undefined);
    useAuditStore.setState({ startAudit });
    const { result } = renderHook(() => useAudit());
    await result.current.startAudit('https://example.test/path');
    expect(startAudit).toHaveBeenCalledExactlyOnceWith('https://example.test/path');
  });
});
