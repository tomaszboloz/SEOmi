import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from '../src/stores/settingsStore';
import { connectSettingsStores } from '@/services/settingsComposition';

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

describe('configuration failure state', () => {

it('keeps the current settings and exposes read failures until a successful reload', async () => {
    const original = useSettingsStore.getState().config;
    settingsMocks.invokeTauriCommandMock.mockRejectedValueOnce(new Error('unreadable configuration'));
    settingsMocks.getSecureValueMock.mockResolvedValue('');
    await useSettingsStore.getState().loadConfig();
    expect(useSettingsStore.getState().config).toEqual(original);
    expect(useSettingsStore.getState().configError).toBeTruthy();
    settingsMocks.invokeTauriCommandMock.mockResolvedValueOnce(original);
    await useSettingsStore.getState().loadConfig();
    expect(useSettingsStore.getState().configError).toBeNull();
  });

it('exposes failed saves rather than clearing the failure as a success', async () => {
    settingsMocks.invokeTauriCommandMock.mockRejectedValueOnce(new Error('disk failure'));
    await useSettingsStore.getState().updateConfig({ theme: 'dark' });
    expect(useSettingsStore.getState().configError).toBeTruthy();
    expect(useSettingsStore.getState().isSaving).toBe(false);
  });
});
