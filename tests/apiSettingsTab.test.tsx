import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ApiSettingsTab } from '@/components/Settings/settings/ApiSettingsTab';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

vi.mock('@/components/DataForSEO/cost/DataForSeoBudgetSettings', () => ({
  DataForSeoBudgetSettings: () => <div data-testid="budget" />,
}));

const props = (): ComponentProps<typeof ApiSettingsTab> => ({
  dataforseoLogin: 'login', setDataforseoLogin: vi.fn(),
  dataforseoPass: 'pass', setDataforseoPass: vi.fn(),
  testingDataForSeo: false, dataForSeoTestStatus: null, handleTestDataForSeo: vi.fn(),
  googleMetricsKey: 'gkey', setGoogleMetricsKey: vi.fn(),
  handleAiKeyChange: vi.fn(), handleSaveGeneral: vi.fn(), savedSuccess: false,
});

describe('ApiSettingsTab', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useAuthStore.setState({ apiKeys: { openai: 'o', claude: 'c', gemini: 'g' } } as never);
    useSettingsStore.setState({ secureStorageError: null, isSaving: false } as never);
  });

  it('shows current values and forwards DataForSEO and Google key edits', () => {
    const p = props();
    render(<ApiSettingsTab {...p} />);
    expect((screen.getByDisplayValue('login') as HTMLInputElement).value).toBe('login');
    fireEvent.change(screen.getByDisplayValue('login'), { target: { value: 'new-login' } });
    fireEvent.change(screen.getByDisplayValue('pass'), { target: { value: 'new-pass' } });
    fireEvent.change(screen.getByDisplayValue('gkey'), { target: { value: 'new-key' } });
    expect(p.setDataforseoLogin).toHaveBeenCalledWith('new-login');
    expect(p.setDataforseoPass).toHaveBeenCalledWith('new-pass');
    expect(p.setGoogleMetricsKey).toHaveBeenCalledWith('new-key');
    expect(screen.getByTestId('budget')).toBeTruthy();
  });

  it('forwards each AI provider key edit with its provider id', () => {
    const p = props();
    render(<ApiSettingsTab {...p} />);
    fireEvent.change(screen.getByDisplayValue('o'), { target: { value: 'o2' } });
    fireEvent.change(screen.getByDisplayValue('c'), { target: { value: 'c2' } });
    fireEvent.change(screen.getByDisplayValue('g'), { target: { value: 'g2' } });
    expect(p.handleAiKeyChange).toHaveBeenNthCalledWith(1, 'openai', 'o2');
    expect(p.handleAiKeyChange).toHaveBeenNthCalledWith(2, 'claude', 'c2');
    expect(p.handleAiKeyChange).toHaveBeenNthCalledWith(3, 'gemini', 'g2');
  });

  it('runs the connection test and shows idle label and status text', () => {
    const p = { ...props(), dataForSeoTestStatus: 'Connected OK' };
    render(<ApiSettingsTab {...p} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('dataforseo.testConnection') }));
    expect(p.handleTestDataForSeo).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Connected OK')).toBeTruthy();
  });

  it('disables the test button and shows the busy label while testing', () => {
    render(<ApiSettingsTab {...props()} testingDataForSeo />);
    const button = screen.getByRole('button', { name: i18n.t('dataforseo.testingConnection') }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: i18n.t('dataforseo.testConnection') })).toBeNull();
  });

  it('saves via the main button and reflects saved state', () => {
    const p = props();
    const { rerender } = render(<ApiSettingsTab {...p} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.settings.saveApi') }));
    expect(p.handleSaveGeneral).toHaveBeenCalledTimes(1);
    rerender(<ApiSettingsTab {...p} savedSuccess />);
    expect(screen.getByRole('button', { name: i18n.t('legacyUi.settings.saved') })).toBeTruthy();
  });

  it('shows secure-storage errors as an alert and disables saving while busy', () => {
    useSettingsStore.setState({ secureStorageError: 'keychain locked', isSaving: true } as never);
    render(<ApiSettingsTab {...props()} />);
    expect(screen.getByRole('alert').textContent).toBe('keychain locked');
    const save = screen.getByRole('button', { name: i18n.t('legacyUi.settings.saveApi') });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(save.getAttribute('aria-busy')).toBe('true');
  });

  it('masks for the AI providers', () => {
    render(<ApiSettingsTab {...props()} />);
    for (const v of ['o', 'c', 'g']) expect((screen.getByDisplayValue(v) as HTMLInputElement).type).toBe('password');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
