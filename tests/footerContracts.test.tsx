import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/Layout/Footer';
import { APP_AUTHOR, APP_AUTHOR_URL, APP_VERSION } from '@/constants/app';
import { invokeTauriCommand } from '@/services/tauri';
import { relaunch } from '@tauri-apps/plugin-process';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn().mockResolvedValue(undefined) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { version?: string }) => `${key}${values?.version ? `:${values.version}` : ''}` }) }));
afterEach(() => { vi.restoreAllMocks(); vi.mocked(invokeTauriCommand).mockReset(); });

describe('footer update contracts', () => {
  it('shows the current version and author and checks for updates in place', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue({ available: false, installed: false, current_version: APP_VERSION });
    render(<Footer />);
    expect(screen.getByText(`app.footerVersion:${APP_VERSION}`)).toBeTruthy();
    const link = screen.getByRole('link', { name: APP_AUTHOR });
    expect(link.getAttribute('href')).toBe(APP_AUTHOR_URL);
    expect(link.getAttribute('rel')).toContain('noreferrer');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'app.footerUpdates' })));
    expect(invokeTauriCommand).toHaveBeenCalledExactlyOnceWith('check_for_updates');
    expect(screen.getByText(`legacyUi.settings.upToDate:${APP_VERSION}`)).toBeTruthy();
    expect(screen.queryByTitle('legacyUi.settings.restartRequired')).toBeNull();
  });
  it('installs an available update from the footer and then offers a restart', async () => {
    vi.mocked(invokeTauriCommand)
      .mockResolvedValueOnce({ available: true, installed: false, version: '9.9.9', current_version: APP_VERSION })
      .mockResolvedValueOnce({ available: true, installed: true, restart_required: true, version: '9.9.9', current_version: APP_VERSION });
    render(<Footer />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'app.footerUpdates' })));
    expect(screen.getByText('legacyUi.settings.updateAvailable:9.9.9')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /installUpdate/ })));
    expect(invokeTauriCommand).toHaveBeenLastCalledWith('install_update');
    expect(screen.getByTitle('legacyUi.settings.restartRequired')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /installUpdate/ })).toBeNull();
  });
  it('shows the failure of an update check as an alert', async () => {
    vi.mocked(invokeTauriCommand).mockRejectedValue(new Error('offline'));
    render(<Footer />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'app.footerUpdates' })));
    expect(screen.getByRole('alert').textContent).toContain('offline');
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
