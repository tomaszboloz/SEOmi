import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppRouting } from '@/hooks/app/useAppRouting';
import { buildWorkspaceHash } from '@/services/workspaceDeepLink';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { projects } from './fixtures/appWorkspaceDeepLinkContracts';

const resetWorkspaceUrl = (hash = '') => {
  window.history.replaceState(null, '', `/workspace${hash}`);
};

describe('useAppRouting ownership', () => {
  beforeEach(() => {
    localStorage.clear();
    resetWorkspaceUrl();
    useProjectStore.setState({ projects: [...projects], activeProjectId: 'project-a' });
    useAuditStore.setState({ activeTab: 'overview' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetWorkspaceUrl();
  });

  it('normalizes a malformed workspace hash to the active project overview', async () => {
    resetWorkspaceUrl('#workspace?project=project-a&tab=not-a-route');
    useAuditStore.setState({ activeTab: 'search-console' });
    const replaceState = vi.spyOn(window.history, 'replaceState');

    const { unmount } = renderHook(() => useAppRouting());

    await waitFor(() => {
      expect(useAuditStore.getState().activeTab).toBe('overview');
      expect(window.location.hash).toBe(
        buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' }),
      );
    });
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining(buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' })),
    );

    unmount();
  });

  it('selects a linked project before applying its tab', async () => {
    resetWorkspaceUrl(buildWorkspaceHash({ projectId: 'project-b', tab: 'keyword-research' }));

    const { unmount } = renderHook(() => useAppRouting());

    await waitFor(() => {
      expect(useProjectStore.getState().activeProjectId).toBe('project-b');
      expect(useAuditStore.getState().activeTab).toBe('keyword-research');
      expect(window.location.hash).toBe(
        buildWorkspaceHash({ projectId: 'project-b', tab: 'keyword-research' }),
      );
    });

    unmount();
  });

  it('ignores crawl evidence hashes and removes the hashchange listener on cleanup', async () => {
    resetWorkspaceUrl('#crawl-evidence?run=run-1');
    useAuditStore.setState({ activeTab: 'search-console' });
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useAppRouting());

    await act(async () => undefined);
    expect(useAuditStore.getState().activeTab).toBe('search-console');
    expect(window.location.hash).toBe('#crawl-evidence?run=run-1');
    expect(replaceState).not.toHaveBeenCalled();

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));
  });

  it('applies a later hashchange while mounted', async () => {
    resetWorkspaceUrl(buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' }));
    const { unmount } = renderHook(() => useAppRouting());

    act(() => {
      window.location.hash = buildWorkspaceHash({ projectId: 'project-a', tab: 'site-audit' });
    });

    await waitFor(() => {
      expect(useAuditStore.getState().activeTab).toBe('site-audit');
    });

    unmount();
  });
});
