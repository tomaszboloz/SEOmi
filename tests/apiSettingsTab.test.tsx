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

  it('saves each AI provider key with its provider id, once, on Enter', () => {
    const p = props();
    render(<ApiSettingsTab {...p} />);
    const fields = (['openai', 'claude', 'gemini'] as const).map((provider) => screen.getByLabelText(i18n.t(`legacyUi.settings.${provider}ApiKey`)));
    fields.forEach((field, index) => fireEvent.change(field, { target: { value: `key-${index}` } }));
    expect(p.handleAiKeyChange).not.toHaveBeenCalled();
    fields.forEach((field) => fireEvent.keyDown(field, { key: 'Enter' }));
    expect(p.handleAiKeyChange).toHaveBeenNthCalledWith(1, 'openai', 'key-0');
    expect(p.handleAiKeyChange).toHaveBeenNthCalledWith(2, 'claude', 'key-1');
    expect(p.handleAiKeyChange).toHaveBeenNthCalledWith(3, 'gemini', 'key-2');
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

  it('masks for the AI providers and marks a stored key without showing it', () => {
    render(<ApiSettingsTab {...props()} />);
    for (const provider of ['openai', 'claude', 'gemini'] as const) {
      const field = screen.getByLabelText(i18n.t(`legacyUi.settings.${provider}ApiKey`)) as HTMLInputElement;
      expect([field.type, field.value, field.placeholder]).toEqual(['password', '', i18n.t('auth.apiKeyStoredPlaceholder')]);
    }
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('marks stored DataForSEO and Google values in the placeholder and keeps the plain hints otherwise', () => {
    const empty = { ...props(), dataforseoLogin: '', dataforseoPass: '', googleMetricsKey: '' };
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' }, googleMetricsApiKey: '' } as never);
    const { unmount } = render(<ApiSettingsTab {...empty} />);
    expect(screen.getByPlaceholderText(i18n.t('dataforseo.loginPlaceholder'))).toBeTruthy();
    expect(screen.getByPlaceholderText(i18n.t('legacyUi.settings.googlePlaceholder'))).toBeTruthy();
    unmount();
    const marker = '__seomi_secret_present__';
    useSettingsStore.setState({ dataForSeoCredentials: { login: marker, password: marker }, googleMetricsApiKey: marker } as never);
    render(<ApiSettingsTab {...empty} />);
    expect(screen.getAllByPlaceholderText(i18n.t('auth.apiKeyStoredPlaceholder'))).toHaveLength(6);
  });

  it('does not render native secret presence markers into AI inputs', () => {
    useAuthStore.setState({ apiKeys: {
      openai: '__seomi_secret_present__',
      claude: '__seomi_secret_present__',
      gemini: '__seomi_secret_present__',
    } } as never);
    render(<ApiSettingsTab {...props()} />);
    const passwordInputs = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')];
    expect(passwordInputs.slice(-3).map((input) => input.value)).toEqual(['', '', '']);
  });
});
