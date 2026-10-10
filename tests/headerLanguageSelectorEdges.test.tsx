import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderLanguageSelector } from '@/components/Layout/header/HeaderLanguageSelector';
import { useSettingsStore } from '@/stores/settingsStore';

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('HeaderLanguageSelector edge interactions', () => {
  const setLanguage = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setLanguage.mockReset();
    useSettingsStore.setState({ language: 'en', setLanguage } as never);
  });

  it('keeps the menu open for inside and unrelated events, then closes outside or on Escape', () => {
    render(<HeaderLanguageSelector />);
    const toggle = screen.getByRole('button', { name: 'settings.language' });
    const menu = screen.getByRole('menu', { name: 'settings.language' });

    fireEvent.click(toggle);
    fireEvent.pointerDown(menu);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerDown(document.body);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('selects the requested language and closes the menu', () => {
    render(<HeaderLanguageSelector />);
    fireEvent.click(screen.getByRole('button', { name: 'settings.language' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Polski pl/i }));

    expect(setLanguage).toHaveBeenCalledWith('pl');
    expect(screen.getByRole('button', { name: 'settings.language' }).getAttribute('aria-expanded')).toBe('false');
  });
});
