import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/Layout/Footer';
import { APP_AUTHOR, APP_AUTHOR_URL, APP_VERSION } from '@/constants/app';
import { useUIStore } from '@/stores/uiStore';
import { relaunch } from '@tauri-apps/plugin-process';

vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn().mockResolvedValue(undefined) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { version?: string }) => `${key}${values?.version ? `:${values.version}` : ''}` }) }));
afterEach(() => vi.restoreAllMocks());

describe('footer update contracts', () => {
  it('shows the current version and author, and opens update settings', () => {
    const openModal = vi.fn();
    useUIStore.setState({ openModal });
    render(<Footer />);
    expect(screen.getByText(`app.footerVersion:${APP_VERSION}`)).toBeTruthy();
    const link = screen.getByRole('link', { name: APP_AUTHOR });
    expect(link.getAttribute('href')).toBe(APP_AUTHOR_URL);
    expect(link.getAttribute('rel')).toContain('noreferrer');
    fireEvent.click(screen.getByRole('button', { name: 'app.footerUpdates' }));
    expect(openModal).toHaveBeenCalledExactlyOnceWith('settings');
    expect(screen.queryByTitle('legacyUi.settings.restartRequired')).toBeNull();
  });
  it('relaunches only after an installed update and clears incomplete update notifications', async () => {
    render(<Footer />);
    act(() => window.dispatchEvent(new CustomEvent('seomi-update-installed', { detail: { version: '0.0.4' } })));
    await act(async () => fireEvent.click(screen.getByTitle('legacyUi.settings.restartRequired')));
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/restartNow.*0.0.4/)).toBeTruthy();
    act(() => window.dispatchEvent(new CustomEvent('seomi-update-installed')));
    expect(screen.queryByTitle('legacyUi.settings.restartRequired')).toBeNull();
    act(() => window.dispatchEvent(new CustomEvent('seomi-update-installed', { detail: { version: '' } })));
    expect(screen.queryByTitle('legacyUi.settings.restartRequired')).toBeNull();
  });
  it('removes its update listener on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Footer />);
    unmount();
    expect(remove).toHaveBeenCalledWith('seomi-update-installed', expect.any(Function));
  });
});
