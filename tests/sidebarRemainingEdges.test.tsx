import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/Layout/Sidebar';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

const project = {
  id: 'sidebar-edges',
  name: 'Sidebar edges',
  rootUrl: 'https://example.test',
  createdAt: '2026-09-23T00:00:00.000Z',
  lastOpenedAt: '2026-09-23T00:00:00.000Z',
};

describe('Sidebar remaining branches', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    useAuditStore.setState({ activeTab: 'overview', currentAudit: null, isLoading: false, isBatchRunning: false });
    useUIStore.setState({ sidebarCollapsed: false, collapsedSections: {}, activeModal: null });
  });

  it('shows search results count or empty result when filtering', () => {
    render(<Sidebar />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'no-such-navigation-item' } });
    expect(screen.getByText(/no-such-navigation-item/i)).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'audit' } });
    expect(screen.getByRole('status').textContent).toBeTruthy();
  });


  it('opens the active section after navigation changes into a collapsed section', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    localStorage.setItem('seomi_project_sidebar-edges_sidebar_sections_v1', JSON.stringify({ 'keyword-research': true }));
    render(<Sidebar />);

    act(() => useAuditStore.getState().setActiveTab('keyword-research'));
    await waitFor(() => expect(useUIStore.getState().collapsedSections['keyword-research']).not.toBe(true));
  });


  it('returns safely from navigation synchronization in compact and unknown-tab states', () => {
    useUIStore.setState({ sidebarCollapsed: true });
    render(<Sidebar />);
    act(() => useAuditStore.getState().setActiveTab('site-audit'));
    expect(screen.getByTitle(/Site Audit Crawler/i)).toBeTruthy();

    act(() => useAuditStore.setState({ activeTab: 'unknown-tab' as never }));
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });
});
