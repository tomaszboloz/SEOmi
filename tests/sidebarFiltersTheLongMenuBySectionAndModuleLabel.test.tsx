import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/Layout/Sidebar';

import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

describe('workspace sidebar information architecture', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: 'sidebar-project', name: 'Sidebar project', createdAt: '2026-09-23T00:00:00.000Z', lastOpenedAt: '2026-09-23T00:00:00.000Z' }],
      activeProjectId: 'sidebar-project',
    });
    useUIStore.setState({ sidebarCollapsed: false, collapsedSections: {}, activeModal: null });
    useAuditStore.setState({ activeTab: 'overview', currentAudit: null });
  });

it('filters the long menu by section and module label, and clears with Escape', () => {
    render(<Sidebar />);
    const search = screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i });

    fireEvent.click(screen.getByRole('button', { name: /Domain & Backlinks/i }));
    expect(screen.queryByRole('button', { name: /Backlink Checker/i })).toBeNull();

    fireEvent.change(search, { target: { value: 'backlink' } });
    expect(screen.getByRole('button', { name: /Domain & Backlinks/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Backlink Checker/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Keyword Research/i })).toBeNull();
    expect(localStorage.getItem('seomi_project_sidebar-project_sidebar_search_v1')).toBe('backlink');
    expect(screen.getByRole('button', { name: /Clear menu search|Wyczyść wyszukiwanie menu/i })).not.toBeNull();

    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getAllByRole('button', { name: /Keyword Research/i }).length).toBeGreaterThanOrEqual(2);
  });

it('also searches the workflow vocabulary, not only visible labels', () => {
    render(<Sidebar />);
    const search = screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i });

    // "SERP" is a discovery term in the navigation contract, not part of
    // the translated labels of either keyword workflow.
    fireEvent.change(search, { target: { value: 'SERP' } });

    expect(screen.getByRole('button', { name: /Keyword Clustering/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Rank Tracking/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Domain Overview/i })).toBeNull();
  });

it('reveals a collapsed active group and scrolls the selected module into view', async () => {
    useUIStore.setState({ collapsedSections: { 'keyword-research': true } });
    render(<Sidebar />);
    const clustering = screen.getByRole('button', { name: /Keyword Clustering/i });
    clustering.scrollIntoView = vi.fn();

    act(() => useAuditStore.getState().setActiveTab('keyword-clustering'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Keyword Research/i, expanded: true })).not.toBeNull();
    });
    await waitFor(() => expect(clustering.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' }));
  });

it('announces the number of matching menu groups for assistive technology', () => {
    render(<Sidebar />);
    const search = screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i });
    fireEvent.change(search, { target: { value: 'backlink' } });

    expect(screen.getByRole('status').textContent).toMatch(/2 menu groups|pasujących grup menu: 2/i);
  });

it('does not trap compact mode inside a hidden menu search filter', () => {
    render(<Sidebar />);
    const search = screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i });

    fireEvent.change(search, { target: { value: 'backlink' } });
    expect(screen.queryByRole('button', { name: /Keyword Research/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Collapse menu|Zwiń menu/i }));
    expect(screen.getByRole('button', { name: /Keyword Research/i })).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: /Search modules|Szukaj modułu/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Expand menu|Rozwiń menu/i }));
    expect((screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i }) as HTMLInputElement).value).toBe('backlink');
    expect(screen.queryByRole('button', { name: /Keyword Research/i })).toBeNull();
  });

it('restores the menu search per project without leaking it to another project', async () => {
    localStorage.setItem('seomi_project_sidebar-project_sidebar_search_v1', 'semantic');
    const { unmount } = render(<Sidebar />);

    await waitFor(() => expect((screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i }) as HTMLInputElement).value).toBe('semantic'));
    expect(screen.getByRole('button', { name: /Semantic map/i })).not.toBeNull();

    unmount();
    useProjectStore.setState({
      projects: [
        { id: 'sidebar-project', name: 'Sidebar project', createdAt: '2026-09-23T00:00:00.000Z', lastOpenedAt: '2026-09-23T00:00:00.000Z' },
        { id: 'second-sidebar-project', name: 'Second project', createdAt: '2026-09-23T00:00:00.000Z', lastOpenedAt: '2026-09-23T00:00:00.000Z' },
      ],
      activeProjectId: 'second-sidebar-project',
    });
    render(<Sidebar />);

    await waitFor(() => expect((screen.getByRole('textbox', { name: /Search modules|Szukaj modułu/i }) as HTMLInputElement).value).toBe(''));
    expect(localStorage.getItem('seomi_project_second-sidebar-project_sidebar_search_v1')).toBeNull();
  });

it('does not leak section state between projects', async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Audits & Crawling/i }));

    act(() => {
      useProjectStore.setState({
        projects: [
          { id: 'sidebar-project', name: 'Sidebar project', createdAt: '2026-09-23T00:00:00.000Z', lastOpenedAt: '2026-09-23T00:00:00.000Z' },
          { id: 'second-sidebar-project', name: 'Second project', createdAt: '2026-09-23T00:00:00.000Z', lastOpenedAt: '2026-09-23T00:00:00.000Z' },
        ],
        activeProjectId: 'second-sidebar-project',
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Audits & Crawling/i }).getAttribute('aria-expanded')).toBe('true');
    });
    expect(localStorage.getItem('seomi_project_second-sidebar-project_sidebar_sections_v1')).toBeNull();
    expect(screen.getByRole('button', { name: /Site Audit Crawler/i })).not.toBeNull();
  });
});
