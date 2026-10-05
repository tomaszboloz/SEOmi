import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledLaunch } from '@/hooks/app/useScheduledLaunch';
import { useProjectStore } from '@/stores/projectStore';

const { isTauri, getCtx } = vi.hoisted(() => ({ isTauri: vi.fn(), getCtx: vi.fn() }));
vi.mock('@/services/tauri', () => ({ isTauriEnvironment: isTauri }));
vi.mock('@/services/scheduleWakeup', () => ({ getScheduledLaunchContext: getCtx }));

const project = (id: string) => ({ id, name: id, createdAt: 'x', lastOpenedAt: 'x' });
const ctx = (projectId: string | null) => ({ projectId, scheduleId: 's1', headless: true });

describe('useScheduledLaunch', () => {
  beforeEach(() => {
    isTauri.mockReset().mockReturnValue(true);
    getCtx.mockReset();
    useProjectStore.setState({ projects: [project('a'), project('b')], activeProjectId: 'a' });
  });

  it('is immediately ready and skips the lookup outside Tauri', () => {
    isTauri.mockReturnValue(false);
    const { result } = renderHook(() => useScheduledLaunch());
    expect(result.current.scheduledLaunchContextReady).toBe(true);
    expect(getCtx).not.toHaveBeenCalled();
  });

  it('waits and does not look up while there are no projects', () => {
    useProjectStore.setState({ projects: [] });
    const { result } = renderHook(() => useScheduledLaunch());
    expect(result.current.scheduledLaunchContextReady).toBe(false);
    expect(getCtx).not.toHaveBeenCalled();
  });

  it('stores the context and selects the launched project', async () => {
    getCtx.mockResolvedValue(ctx('b'));
    const { result } = renderHook(() => useScheduledLaunch());
    await waitFor(() => expect(result.current.scheduledLaunchContextReady).toBe(true));
    expect(result.current.scheduledLaunchContext).toEqual(ctx('b'));
    expect(useProjectStore.getState().activeProjectId).toBe('b');
  });

  it('keeps the active project when the context targets it already', async () => {
    getCtx.mockResolvedValue(ctx('a'));
    const select = vi.spyOn(useProjectStore.getState(), 'selectProject');
    useProjectStore.setState({ selectProject: select });
    const { result } = renderHook(() => useScheduledLaunch());
    await waitFor(() => expect(result.current.scheduledLaunchContextReady).toBe(true));
    expect(select).not.toHaveBeenCalled();
  });

  it.each([['unknown project', 'zzz'], ['null project', null]])(
    'does not switch project for %s',
    async (_n, id) => {
      getCtx.mockResolvedValue(ctx(id));
      const { result } = renderHook(() => useScheduledLaunch());
      await waitFor(() => expect(result.current.scheduledLaunchContextReady).toBe(true));
      expect(result.current.scheduledLaunchContext.scheduleId).toBe('s1');
      expect(useProjectStore.getState().activeProjectId).toBe('a');
    },
  );

  it('becomes ready even when the lookup fails', async () => {
    getCtx.mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => useScheduledLaunch());
    await waitFor(() => expect(result.current.scheduledLaunchContextReady).toBe(true));
    expect(result.current.scheduledLaunchContext.projectId).toBeNull();
  });

  it('ignores results that resolve after unmount', async () => {
    let resolve!: (v: ReturnType<typeof ctx>) => void;
    let reject!: (e: Error) => void;
    getCtx.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderHook(() => useScheduledLaunch()).unmount();
    getCtx.mockReturnValueOnce(new Promise((_, r) => { reject = r; }));
    const second = renderHook(() => useScheduledLaunch());
    second.unmount();
    await act(async () => { resolve(ctx('b')); reject(new Error('late')); });
    expect(useProjectStore.getState().activeProjectId).toBe('a');
    expect(second.result.current.scheduledLaunchContextReady).toBe(false);
  });

  it('lets callers overwrite the context', () => {
    isTauri.mockReturnValue(false);
    const { result } = renderHook(() => useScheduledLaunch());
    act(() => result.current.setScheduledLaunchContext(ctx('a')));
    expect(result.current.scheduledLaunchContext.headless).toBe(true);
  });
});
