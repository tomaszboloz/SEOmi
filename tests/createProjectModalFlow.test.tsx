import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CreateProjectModal } from '@/components/Projects/CreateProjectModal';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

const createProject = vi.fn();
const closeModal = vi.fn();
const nameField = () => screen.getByPlaceholderText(i18n.t('projects.namePlaceholder')) as HTMLInputElement;
const urlField = () => screen.getByPlaceholderText(i18n.t('projects.startingDomainPlaceholder')) as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('projects.createAndOpen') }));
const fill = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  createProject.mockReset();
  closeModal.mockReset();
  useProjectStore.setState({ createProject } as never);
  useUIStore.setState({ closeModal } as never);
  render(<CreateProjectModal />);
});

describe('CreateProjectModal flow', () => {
  it('focuses the name field on open', () => {
    expect(document.activeElement).toBe(nameField());
  });

  it('rejects a blank name, focuses it, and clears the error once typing resumes', () => {
    fill(nameField(), '   ');
    fireEvent.blur(nameField());
    submit();
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('projects.validation.nameRequired'));
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    fill(nameField(), '   ');
    expect(screen.queryByRole('alert')).not.toBeNull();
    fill(nameField(), 'My site');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('flags an invalid URL on the URL field and clears it when that field changes', () => {
    fill(nameField(), 'Site');
    fill(urlField(), 'ftp://x.test');
    submit();
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('projects.validation.httpOnly'));
    expect(urlField().getAttribute('aria-invalid')).toBe('true');
    fill(urlField(), 'https://x.test');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('keeps a name error visible while the URL field is edited', () => {
    fill(nameField(), ' ');
    submit();
    fill(urlField(), 'https://a.test');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('creates the project with the normalised URL and closes', () => {
    fill(nameField(), 'Site');
    fill(urlField(), 'example.com');
    submit();
    expect(createProject).toHaveBeenCalledWith({ name: 'Site', rootUrl: 'https://example.com' });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('shows the thrown Error message or the generic fallback and stays open', () => {
    fill(nameField(), 'Site');
    createProject.mockImplementationOnce(() => { throw new Error('duplicate project'); });
    submit();
    expect(screen.getByRole('alert').textContent).toBe('duplicate project');
    createProject.mockImplementationOnce(() => { throw 'weird'; });
    submit();
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('projects.createError'));
    expect(closeModal).not.toHaveBeenCalled();
  });

  it('closes via cancel, backdrop press and Escape but not when pressing inside the dialog', () => {
    fireEvent.click(screen.getByRole('button', { name: i18n.t('projects.cancel') }));
    expect(closeModal).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(closeModal).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(closeModal).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(closeModal).toHaveBeenCalledTimes(3);
  });
});
