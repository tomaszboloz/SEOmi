import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandPalette } from '@/components/Layout/CommandPalette';
import { useUIStore } from '@/stores/uiStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';

beforeEach(() => {
  useProjectStore.setState({ projects: [], activeProjectId: null });
  useAuditStore.setState({ activeTab: 'overview' });
  useUIStore.setState({ commandPaletteOpen: true, activeModal: null });
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe.each(['en', 'pl'])('command palette keyboard activation in %s', (language) => {
  it('preserves native Enter activation on the close button without executing a result', async () => {
    await i18n.changeLanguage(language);
    render(<CommandPalette />);
    const close = screen.getByRole('button', { name: i18n.t('commandPalette.close') });
    close.focus();

    expect(fireEvent.keyDown(close, { key: 'Enter' })).toBe(true);
    expect(useUIStore.getState().activeModal).toBeNull();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    // jsdom does not synthesize a button click from Enter.
    fireEvent.click(close);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('lets a focused result activate itself when the arrow-selected result differs', async () => {
    await i18n.changeLanguage(language);
    render(<CommandPalette />);
    const input = screen.getByRole('textbox', { name: i18n.t('commandPalette.searchLabel') });
    fireEvent.change(input, { target: { value: 'backlink' } });
    const target = screen.getByRole('option', { name: new RegExp(i18n.t('sidebar.backlinkChecker')) });
    fireEvent.change(input, { target: { value: '' } });
    const focusedOption = document.getElementById(target.id)!;
    focusedOption.focus();

    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).not.toBe(target.id);
    expect(fireEvent.keyDown(focusedOption, { key: 'Enter' })).toBe(true);
    expect(useUIStore.getState().activeModal).toBeNull();
    fireEvent.click(focusedOption);
    expect(useAuditStore.getState().activeTab).toBe('backlink-checker');
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('executes the selected result from search, then reopens with a clean query and selection', async () => {
    await i18n.changeLanguage(language);
    render(<CommandPalette />);
    const dialog = screen.getByRole('dialog', { name: i18n.t('commandPalette.title') });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const input = screen.getByRole('textbox', { name: i18n.t('commandPalette.searchLabel') });
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.change(input, { target: { value: 'backlink' } });
    const result = screen.getByRole('option');
    expect(screen.getByRole('listbox', { name: i18n.t('commandPalette.results') })
      .getAttribute('aria-activedescendant')).toBe(result.id);
    expect(result.getAttribute('aria-selected')).toBe('true');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(useAuditStore.getState().activeTab).toBe('backlink-checker');
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => useUIStore.getState().openCommandPalette());
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant'))
      .toBe(screen.getAllByRole('option')[0].id);
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
