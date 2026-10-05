import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrawlEvidenceRouting } from '@/hooks/app/useCrawlEvidenceRouting';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

const selectProject = vi.fn();
const setActiveTab = vi.fn();
const link = (params: Record<string, string>) => `#crawl-evidence?${new URLSearchParams(params)}`;
const full = { project: 'p2', run: 'r1', url: 'https://x.test/' };

beforeEach(() => {
  selectProject.mockReset();
  setActiveTab.mockReset();
  window.location.hash = '';
  useProjectStore.setState({ projects: [{ id: 'p1' }, { id: 'p2' }] as never, activeProjectId: 'p1', selectProject } as never);
  useAuditStore.setState({ setActiveTab } as never);
});

describe('useCrawlEvidenceRouting', () => {
  it('switches project and opens the site audit tab for a matching hash on mount', () => {
    window.location.hash = link(full);
    renderHook(() => useCrawlEvidenceRouting());
    expect(selectProject).toHaveBeenCalledWith('p2');
    expect(setActiveTab).toHaveBeenCalledWith('site-audit');
  });

  it('keeps the active project when the link points at it', () => {
    window.location.hash = link({ ...full, project: 'p1' });
    renderHook(() => useCrawlEvidenceRouting());
    expect(selectProject).not.toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith('site-audit');
  });

  it.each([
    ['another hash', '#other?project=p2&run=r&url=u'],
    ['a missing project', link({ run: 'r1', url: 'u' })],
    ['a missing run', link({ project: 'p2', url: 'u' })],
    ['a missing url', link({ project: 'p2', run: 'r1' })],
    ['an unknown project', link({ ...full, project: 'ghost' })],
  ])('ignores %s', (_name, hash) => {
    window.location.hash = hash;
    renderHook(() => useCrawlEvidenceRouting());
    expect(selectProject).not.toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('reacts to later hash changes and stops after unmount', () => {
    const { unmount } = renderHook(() => useCrawlEvidenceRouting());
    expect(setActiveTab).not.toHaveBeenCalled();
    act(() => { window.location.hash = link(full); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(selectProject).toHaveBeenCalledWith('p2');
    unmount();
    setActiveTab.mockClear();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});
