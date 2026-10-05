import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { Header } from '@/components/Layout/Header';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/components/Projects/ProjectSwitcher', () => ({ ProjectSwitcher: () => <i data-testid="switcher" /> }));
vi.mock('@/components/Layout/header/HeaderLanguageSelector', () => ({ HeaderLanguageSelector: () => <i data-testid="lang" /> }));

const setup = (provider: 'claude' | 'openai' | 'gemini', connected: boolean, theme: 'dark' | 'light' = 'dark') => {
  const openModal = vi.fn(); const openCommandPalette = vi.fn(); const setTheme = vi.fn();
  useUIStore.setState({ openModal, openCommandPalette } as never);
  useSettingsStore.setState({ theme, setTheme } as never);
  useAuthStore.setState({ provider, connectionStatus: { [provider]: connected ? 'connected' : 'disconnected' } } as never);
  render(<Header />);
  return { openModal, openCommandPalette, setTheme };
};

describe('Header', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it.each([['claude', 'legacyUi.ai.claude'], ['openai', 'legacyUi.ai.openai'], ['gemini', 'legacyUi.ai.gemini']] as const)('shows the connected %s provider label', (provider, key) => {
    setup(provider, true);
    expect(screen.getByText(`${i18n.t(key)} ${i18n.t('header.active')}`)).toBeTruthy();
    expect(screen.getByText(i18n.t('header.direct'))).toBeTruthy();
  });

  it('prompts to connect AI when disconnected and opens the subscription modal', () => {
    const { openModal } = setup('claude', false);
    expect(screen.getByText(i18n.t('header.connectAi'))).toBeTruthy();
    expect(screen.getByText(i18n.t('header.byok'))).toBeTruthy();
    fireEvent.click(screen.getByTitle(i18n.t('header.aiConnectionTitle')));
    expect(openModal).toHaveBeenCalledWith('subscription');
  });

  it('opens the palette, assistant, history and settings', () => {
    const { openModal, openCommandPalette } = setup('claude', false);
    fireEvent.click(screen.getByLabelText(i18n.t('header.openQuickNavigation')));
    expect(openCommandPalette).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTitle(i18n.t('header.aiOptimizerTitle')));
    fireEvent.click(screen.getByTitle(i18n.t('urlBar.history')));
    fireEvent.click(screen.getByLabelText(i18n.t('sidebar.settings')));
    expect(openModal.mock.calls.map((c) => c[0])).toEqual(['ai', 'history', 'settings']);
    expect(screen.getByTestId('switcher')).toBeTruthy();
    expect(screen.getByTestId('lang')).toBeTruthy();
  });

  it('toggles the theme from dark to light', () => {
    const { setTheme } = setup('claude', false, 'dark');
    fireEvent.click(screen.getByTitle(i18n.t('settings.light')));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('toggles the theme from light to dark', () => {
    const { setTheme } = setup('claude', false, 'light');
    fireEvent.click(screen.getByTitle(i18n.t('settings.dark')));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
