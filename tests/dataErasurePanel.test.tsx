import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { DataErasurePanel } from '@/components/Settings/DataErasurePanel';
import { useProjectStore } from '@/stores/projectStore';

const erase = vi.hoisted(() => vi.fn());
const desktop = vi.hoisted(() => ({ value: true }));
vi.mock('@/services/dataErasure', () => ({ eraseProjectData: erase }));
vi.mock('@/services/tauri', async (importOriginal) => ({ ...(await importOriginal<object>()), isTauriEnvironment: () => desktop.value }));

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];

beforeEach(() => { desktop.value = true; erase.mockReset(); useProjectStore.setState({ activeProjectId: 'proj-gdpr' }); });
afterEach(cleanup);

it('requires the typed project ID before erasing and reports the deleted counts', async () => {
  erase.mockResolvedValue({ recordsDeleted: 7, runsDeleted: 3 });
  render(<DataErasurePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Erase project data' }));
  const run = screen.getByRole('button', { name: 'Erase permanently' }) as HTMLButtonElement;
  expect(run.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/Type the project ID/), { target: { value: 'wrong' } });
  expect(run.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/Type the project ID/), { target: { value: 'proj-gdpr' } });
  fireEvent.click(run);
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Erased: 7 records and 3 crawl runs.'));
  expect(erase).toHaveBeenCalledExactlyOnceWith('proj-gdpr');
  expect(screen.queryByLabelText(/Type the project ID/)).toBeNull();
});

it('shows the failure message and lets the user cancel without erasing', async () => {
  erase.mockRejectedValue(new Error('disk busy'));
  render(<DataErasurePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Erase project data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(erase).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Erase project data' }));
  fireEvent.change(screen.getByLabelText(/Type the project ID/), { target: { value: 'proj-gdpr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Erase permanently' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Erasure failed: disk busy'));
});

it('stringifies non-Error failures', async () => {
  erase.mockRejectedValue('plain failure');
  render(<DataErasurePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Erase project data' }));
  fireEvent.change(screen.getByLabelText(/Type the project ID/), { target: { value: 'proj-gdpr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Erase permanently' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('plain failure'));
});

it('is disabled without a project or outside the desktop app', () => {
  useProjectStore.setState({ activeProjectId: null as never });
  render(<DataErasurePanel />);
  expect((screen.getByRole('button', { name: 'Erase project data' }) as HTMLButtonElement).disabled).toBe(true);
  cleanup();
  useProjectStore.setState({ activeProjectId: 'proj-gdpr' });
  desktop.value = false;
  render(<DataErasurePanel />);
  expect((screen.getByRole('button', { name: 'Erase project data' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Available in the desktop app only.')).toBeTruthy();
});

it('ignores a run attempt with a mismatching ID', () => {
  render(<DataErasurePanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Erase project data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Erase permanently' }));
  expect(erase).not.toHaveBeenCalled();
});

it('translates every erasure string in every locale', async () => {
  const english = (await import('@/i18n/locales/en.json')).default.dataErasureUi;
  for (const locale of LOCALES) {
    const block = (await import(`@/i18n/locales/${locale}.json`)).default.dataErasureUi as Record<string, string>;
    expect(Object.keys(block).sort(), locale).toEqual(Object.keys(english).sort());
    expect(block.confirm, locale).toContain('{{id}}');
    expect(block.done, locale).toContain('{{records}}');
    expect(block.done, locale).toContain('{{runs}}');
    expect(block.failed, locale).toContain('{{message}}');
    if (locale !== 'en') expect(block.title, locale).not.toBe(english.title);
  }
});
