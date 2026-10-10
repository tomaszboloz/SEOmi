import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';

import { connectSettingsStores } from '@/services/settingsComposition';
let disconnect: () => void;
beforeAll(() => { disconnect = connectSettingsStores(); });
afterAll(() => disconnect());

const settingsMocks = vi.hoisted(() => ({
  getSecureValueMock: vi.fn(),
  setSecureValueMock: vi.fn(),
  invokeTauriCommandMock: vi.fn(),
}));

vi.mock('../src/services/tauri', () => ({
  getSecureValue: settingsMocks.getSecureValueMock,
  setSecureValue: settingsMocks.setSecureValueMock,
  invokeTauriCommand: settingsMocks.invokeTauriCommandMock,
}));

describe('general settings propagate into the active audit controls', () => {
  const originalConfig = useSettingsStore.getState().config;
  it('restores persisted user agent and provider/model after restarting', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue({ ...originalConfig, default_user_agent: 'custom-agent/1.0', ai_provider: 'claude', ai_model: 'claude-test-model' });
    settingsMocks.getSecureValueMock.mockResolvedValue('');
    await useSettingsStore.getState().loadConfig();
    expect(useAuditStore.getState().selectedUserAgent).toBe('custom-agent/1.0');
    expect(useAuthStore.getState().provider).toBe('claude');
    expect(useAuthStore.getState().model).toBe('claude-test-model');
    useSettingsStore.setState({ config: originalConfig });
  });

  it('applies the selected theme to the document and persists it', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue(undefined);
    await useSettingsStore.getState().updateConfig({ theme: 'light' });
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('seomi_theme')).toBe('light');
    await useSettingsStore.getState().updateConfig({ theme: 'dark' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('keeps the saved AI connection instead of the stale general-settings provider', async () => {
    // The user picked Claude over the local CLI; the general settings record
    // still carries the default provider because nothing ever updates it.
    useAuthStore.getState().setProvider('claude');
    useAuthStore.getState().setConnectionMethod('claude', 'local_cli');
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue({ ...originalConfig, ai_provider: 'openai', ai_model: 'gpt-4o' });
    settingsMocks.getSecureValueMock.mockResolvedValue('');

    await useSettingsStore.getState().loadConfig();

    expect(useAuthStore.getState().provider).toBe('claude');
    expect(useAuthStore.getState().connectionMethod.claude).toBe('local_cli');
    expect(localStorage.getItem('seomi_ai_provider')).toBe('claude');
    localStorage.removeItem('seomi_ai_provider');
    useSettingsStore.setState({ config: originalConfig });
  });

  it('immediately applies a changed default user agent and persists it', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue(undefined);
    await useSettingsStore.getState().updateConfig({ default_user_agent: 'googlebot_mobile' });
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot_mobile');
    expect(settingsMocks.invokeTauriCommandMock).toHaveBeenCalledWith('save_config', expect.objectContaining({ config: expect.objectContaining({ default_user_agent: 'googlebot_mobile' }) }));
    useSettingsStore.setState({ config: originalConfig });
  });

  it('sets configError on save failure and recovers gracefully on subsequent saves', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockRejectedValueOnce(new Error('disk full'));
    await useSettingsStore.getState().updateConfig({ theme: 'dark' });
    expect(useSettingsStore.getState().configError).toBeTruthy();

    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValueOnce(undefined);
    await useSettingsStore.getState().updateConfig({ theme: 'light' });
    expect(useSettingsStore.getState().configError).toBeNull();
    useSettingsStore.setState({ config: originalConfig });
  });

  it('handles empty ai_model in loadConfig when no stored provider exists', async () => {
    localStorage.removeItem('seomi_ai_provider');
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue({
      ...originalConfig,
      ai_provider: 'openai',
      ai_model: null,
    });
    settingsMocks.getSecureValueMock.mockResolvedValue('');
    await useSettingsStore.getState().loadConfig();
    expect(useAuthStore.getState().provider).toBe('openai');
    useSettingsStore.setState({ config: originalConfig });
  });

});
