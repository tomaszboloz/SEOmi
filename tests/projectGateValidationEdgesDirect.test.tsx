import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectGate } from '@/components/Projects/ProjectGate';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';

const original = useProjectStore.getState();
const originalLanguage = i18n.language;
const nameInput = () => screen.getByLabelText(/Nazwa projektu/i);
const rootInput = () => screen.getByLabelText(/Domena startowa/i);
const submit = () => fireEvent.submit(nameInput().closest('form')!);

describe('ProjectGate validation and creation failure contracts', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pl');
    useProjectStore.setState({ projects: [], activeProjectId: null });
  });
  afterEach(async () => {
    cleanup();
    useProjectStore.setState(original, true);
    vi.restoreAllMocks();
    await i18n.changeLanguage(originalLanguage);
  });

  it('retains an empty-name alert while other fields or whitespace change', () => {
    const createProject = vi.fn();
    useProjectStore.setState({ createProject });
    render(<ProjectGate />);
    submit();
    expect(screen.getByRole('alert').textContent).toContain(i18n.t('projects.validation.nameRequired'));
    expect(nameInput().getAttribute('aria-describedby')).toBe('project-gate-name-error');
    fireEvent.change(rootInput(), { target: { value: 'example.com' } });
    fireEvent.change(nameInput(), { target: { value: '   ' } });
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain(i18n.t('projects.validation.nameRequired'));
    expect(createProject).not.toHaveBeenCalled();
    fireEvent.change(nameInput(), { target: { value: 'Valid project' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(nameInput().getAttribute('aria-invalid')).toBe('false');
    expect(nameInput().hasAttribute('aria-describedby')).toBe(false);
    submit();
    expect(createProject).toHaveBeenCalledExactlyOnceWith({ name: 'Valid project', rootUrl: 'https://example.com' });
  });

  it.each([new Error('storage unavailable'), 'opaque failure'])(
    'displays creation failure and clears it on URL edit: %s', error => {
      const createProject = vi.fn(() => { throw error; });
      useProjectStore.setState({ createProject });
      render(<ProjectGate />);
      fireEvent.change(nameInput(), { target: { value: 'Valid project' } });
      submit();
      expect(createProject).toHaveBeenCalledExactlyOnceWith({ name: 'Valid project', rootUrl: undefined });
      expect(screen.getByRole('alert').textContent).toContain(
        error instanceof Error ? error.message : i18n.t('projects.createError'),
      );
      expect(rootInput().getAttribute('aria-describedby')).toBe('project-gate-root-url-error');
      expect(useProjectStore.getState().projects).toEqual([]);
      fireEvent.change(rootInput(), { target: { value: 'example.com' } });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(rootInput().getAttribute('aria-invalid')).toBe('false');
      expect(rootInput().hasAttribute('aria-describedby')).toBe(false);
    },
  );
});
