import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from '@/components/Layout/Sidebar';

import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import i18n from '@/i18n';

describe('project creation while a workspace is active', () => {
beforeEach(async () => {
    await i18n.changeLanguage('pl');
    localStorage.clear();
    useProjectStore.setState({ projects: [], activeProjectId: null });
    useUIStore.setState({ activeModal: 'create-project' });
  });

afterEach(() => {
    useUIStore.setState({ activeModal: null });
  });

it('keeps new-project creation available from the active workspace sidebar', () => {
    useProjectStore.setState({
      projects: [{ id: 'active-project', name: 'Pierwszy serwis', createdAt: '2026-09-21T00:00:00.000Z', lastOpenedAt: '2026-09-21T00:00:00.000Z' }],
      activeProjectId: 'active-project',
    });
    useUIStore.setState({ activeModal: null, sidebarCollapsed: false });

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Create new project|Utwórz nowy projekt/i }));

    expect(useUIStore.getState().activeModal).toBe('create-project');
  });

it('ignores an unknown project id instead of persisting a broken active context', () => {
    useProjectStore.setState({
      projects: [{ id: 'known-project', name: 'Znany', createdAt: '2026-09-21T00:00:00.000Z', lastOpenedAt: '2026-09-21T00:00:00.000Z' }],
      activeProjectId: 'known-project',
    });

    useProjectStore.getState().selectProject('missing-project');

    expect(useProjectStore.getState().activeProjectId).toBe('known-project');
    expect(localStorage.getItem('seomi_active_project_v1')).toBeNull();
  });

it('fails closed when workspace storage rejects a project write', () => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'seomi_projects_v1') throw new DOMException('Storage is full', 'QuotaExceededError');
      originalSetItem(key, value);
    });

    expect(() => useProjectStore.getState().createProject({ name: 'Nie zapisany', rootUrl: 'https://example.com' }))
      .toThrow(i18n.t('runtimeErrors.persistence.workspaceUnavailable'));
    expect(useProjectStore.getState().projects).toHaveLength(0);
    expect(useProjectStore.getState().activeProjectId).toBeNull();
    setItem.mockRestore();
  });
});
