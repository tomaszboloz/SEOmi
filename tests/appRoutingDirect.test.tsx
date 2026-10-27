import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppRouting } from '@/hooks/app/useAppRouting';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import type { SeoProject } from '@/types';

describe('useAppRouting direct contracts', () => {
  const sampleProject: SeoProject = {
    id: 'proj-1',
    name: 'Project 1',
    rootUrl: 'https://example.com',
    createdAt: '2026-01-01T00:00:00Z',
    lastOpenedAt: '2026-01-01T00:00:00Z',
  };
  const otherProject: SeoProject = {
    id: 'proj-2',
    name: 'Project 2',
    rootUrl: 'https://other.com',
    createdAt: '2026-01-01T00:00:00Z',
    lastOpenedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    window.location.hash = '';
    useProjectStore.setState({
      projects: [sampleProject, otherProject],
      activeProjectId: 'proj-1',
    });
    useAuditStore.setState({ activeTab: 'overview' });
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('ignores crawl-evidence hash completely', () => {
    window.location.hash = '#crawl-evidence?runId=123';
    const { unmount } = renderHook(() => useAppRouting());
    expect(window.location.hash).toBe('#crawl-evidence?runId=123');
    unmount();
  });

  it('normalizes malformed hash to overview when active project exists', () => {
    window.location.hash = '#invalid-malformed-hash';
    const { unmount } = renderHook(() => useAppRouting());
    expect(useAuditStore.getState().activeTab).toBe('overview');
    unmount();
  });

  it('routes to project and tab on valid hashchange event', () => {
    const { unmount } = renderHook(() => useAppRouting());

    act(() => {
      window.location.hash = '#workspace?project=proj-1&tab=links';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(useAuditStore.getState().activeTab).toBe('links');

    // Switch to another project via deep-link
    act(() => {
      window.location.hash = '#workspace?project=proj-2&tab=security';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(useProjectStore.getState().activeProjectId).toBe('proj-2');
    unmount();
  });

  it('ignores deep-link to unknown project', () => {
    const { unmount } = renderHook(() => useAppRouting());
    act(() => {
      window.location.hash = '#workspace?project=unknown-proj&tab=overview';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(useProjectStore.getState().activeProjectId).toBe('proj-1');
    unmount();
  });

  it('syncs activeTab changes to window location hash', () => {
    const { unmount } = renderHook(() => useAppRouting());
    act(() => {
      useAuditStore.getState().setActiveTab('performance');
    });
    expect(window.location.hash).toContain('performance');
    unmount();
  });
});
