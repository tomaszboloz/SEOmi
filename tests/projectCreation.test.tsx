import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateProjectModal } from '@/components/Projects/CreateProjectModal';

import { ProjectGate } from '@/components/Projects/ProjectGate';
import { ProjectSwitcher } from '@/components/Projects/ProjectSwitcher';
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

it('creates, persists, selects, and opens the new project from the workspace dialog', () => {
    render(<CreateProjectModal />);

    fireEvent.change(screen.getByLabelText(/Project name|Nazwa projektu/i), { target: { value: 'Drugi serwis' } });
    fireEvent.change(screen.getByLabelText(/Starting domain|Domena startowa/i), { target: { value: 'https://second.example' } });
    fireEvent.click(screen.getByRole('button', { name: /Create and open|Utwórz i otwórz/i }));

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]).toMatchObject({ name: 'Drugi serwis', rootUrl: 'https://second.example' });
    expect(state.activeProjectId).toBe(state.projects[0].id);
    expect(JSON.parse(localStorage.getItem('seomi_projects_v1') || '[]')).toHaveLength(1);
    expect(localStorage.getItem('seomi_active_project_v1')).toBe(state.projects[0].id);
    expect(useUIStore.getState().activeModal).toBeNull();
  });

it('treats project creation as a real modal: Escape closes it and restores the opener', () => {
    const opener = document.createElement('button');
    opener.type = 'button';
    opener.textContent = 'Open project dialog';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<CreateProjectModal />);

    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useUIStore.getState().activeModal).toBeNull();

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

it('leaves the current project unchanged when the dialog is cancelled', () => {
    useProjectStore.setState({
      projects: [{ id: 'active-project', name: 'Pierwszy serwis', createdAt: '2026-09-21T00:00:00.000Z', lastOpenedAt: '2026-09-21T00:00:00.000Z' }],
      activeProjectId: 'active-project',
    });
    render(<CreateProjectModal />);

    fireEvent.click(screen.getByRole('button', { name: /Cancel|Anuluj/i }));

    expect(useProjectStore.getState().activeProjectId).toBe('active-project');
    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useUIStore.getState().activeModal).toBeNull();
  });

it('keeps project creation in the selector instead of adding a duplicate header action', () => {
    useProjectStore.setState({
      projects: [{ id: 'active-project', name: 'Pierwszy serwis', createdAt: '2026-09-21T00:00:00.000Z', lastOpenedAt: '2026-09-21T00:00:00.000Z' }],
      activeProjectId: 'active-project',
    });
    useUIStore.setState({ activeModal: null });

    render(<ProjectSwitcher />);
    expect(screen.queryByRole('button', { name: /Create new project|Utwórz nowy projekt/i })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: /Active project|Aktywny projekt/i }), { target: { value: '__create_project__' } });

    expect(useUIStore.getState().activeModal).toBe('create-project');
  });

it('creates and activates the first project from the project chooser', () => {
    render(<ProjectGate />);

    fireEvent.change(screen.getByLabelText(/Project name|Nazwa projektu/i), { target: { value: 'Pierwszy projekt' } });
    fireEvent.change(screen.getByLabelText(/Starting domain|Domena startowa/i), { target: { value: 'https://first.example' } });
    fireEvent.click(screen.getByRole('button', { name: /Create and open project|Utwórz i otwórz projekt/i }));

    const state = useProjectStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]).toMatchObject({ name: 'Pierwszy projekt', rootUrl: 'https://first.example' });
    expect(state.activeProjectId).toBe(state.projects[0].id);
    expect(JSON.parse(localStorage.getItem('seomi_projects_v1') || '[]')).toHaveLength(1);
  });

it('does not persist an invalid or private root URL from the project chooser', () => {
    render(<ProjectGate />);

    fireEvent.change(screen.getByLabelText(/Project name|Nazwa projektu/i), { target: { value: 'Niebezpieczny projekt' } });
    fireEvent.change(screen.getByLabelText(/Starting domain|Domena startowa/i), { target: { value: 'http://127.0.0.1:8080' } });
    fireEvent.click(screen.getByRole('button', { name: /Create and open project|Utwórz i otwórz projekt/i }));

    expect(screen.getByRole('alert').textContent).toContain('lokalnego ani prywatnego');
    expect(screen.getByLabelText(/Starting domain|Domena startowa/i).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText(/Starting domain|Domena startowa/i).getAttribute('aria-describedby')).toBe('project-gate-root-url-error');
    expect(useProjectStore.getState().projects).toHaveLength(0);
    expect(localStorage.getItem('seomi_projects_v1')).toBeNull();
  });

it('normalizes a scheme-less public root URL before persistence', () => {
    render(<ProjectGate />);

    fireEvent.change(screen.getByLabelText(/Project name|Nazwa projektu/i), { target: { value: 'Publiczny projekt' } });
    fireEvent.change(screen.getByLabelText(/Starting domain|Domena startowa/i), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create and open project|Utwórz i otwórz projekt/i }));

    expect(useProjectStore.getState().projects[0]?.rootUrl).toBe('https://example.com');
  });

it('enforces project name limits even when the caller bypasses the form', () => {
    expect(() => useProjectStore.getState().createProject({ name: 'x'.repeat(81), rootUrl: 'https://example.com' })).toThrow('maksymalnie 80 znaków');
    expect(useProjectStore.getState().projects).toHaveLength(0);
  });

it('opens project creation from the project selector option', () => {
    useProjectStore.setState({
      projects: [{ id: 'active-project', name: 'Pierwszy serwis', createdAt: '2026-09-21T00:00:00.000Z', lastOpenedAt: '2026-09-21T00:00:00.000Z' }],
      activeProjectId: 'active-project',
    });
    useUIStore.setState({ activeModal: null });

    render(<ProjectSwitcher />);
    fireEvent.change(screen.getByRole('combobox', { name: /Active project|Aktywny projekt/i }), { target: { value: '__create_project__' } });

    expect(useUIStore.getState().activeModal).toBe('create-project');
    expect(useProjectStore.getState().activeProjectId).toBe('active-project');
  });
});
