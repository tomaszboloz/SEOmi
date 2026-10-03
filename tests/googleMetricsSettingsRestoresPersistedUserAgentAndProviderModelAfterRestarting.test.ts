import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { connectSettingsStores } from '@/services/settingsComposition';
import { originalConfig } from "./fixtures/googleMetricsSettingsContracts";
let disconnect: () => void;

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

beforeAll(() => { disconnect = connectSettingsStores(); });

afterAll(() => disconnect());

describe('general settings propagate into the active audit controls', () => {

it('restores persisted user agent and provider/model after restarting', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue({ ...originalConfig, default_user_agent: 'custom-agent/1.0', ai_provider: 'claude', ai_model: 'claude-test-model' });
    settingsMocks.getSecureValueMock.mockResolvedValue('');
    await useSettingsStore.getState().loadConfig();
    expect(useAuditStore.getState().selectedUserAgent).toBe('custom-agent/1.0');
    expect(useAuthStore.getState().provider).toBe('claude');
    expect(useAuthStore.getState().model).toBe('claude-test-model');
    useSettingsStore.setState({ config: originalConfig });
  });

it('immediately applies a changed default user agent and persists it', async () => {
    settingsMocks.invokeTauriCommandMock.mockReset().mockResolvedValue(undefined);
    await useSettingsStore.getState().updateConfig({ default_user_agent: 'googlebot_mobile' });
    expect(useAuditStore.getState().selectedUserAgent).toBe('googlebot_mobile');
    expect(settingsMocks.invokeTauriCommandMock).toHaveBeenCalledWith('save_config', expect.objectContaining({ config: expect.objectContaining({ default_user_agent: 'googlebot_mobile' }) }));
    useSettingsStore.setState({ config: originalConfig });
  });
});
