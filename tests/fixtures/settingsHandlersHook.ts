import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsHandlers } from '@/components/Settings/settings/settingsHandlers';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { DataForSEOClient } from '@/services/dataforseo';

export function settingsHandlersHook() {
  const saveDataForSeoCredentials = vi.fn().mockResolvedValue(undefined);
  const saveGoogleMetricsApiKey = vi.fn().mockResolvedValue(undefined);
  const setApiKey = vi.fn().mockResolvedValue(undefined);
  useAuthStore.setState({ setApiKey });
  const verify = vi.spyOn(DataForSEOClient.prototype, 'verifyCredentials').mockResolvedValue(undefined);
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'login', password: 'password' }, googleMetricsApiKey: 'google', saveDataForSeoCredentials, saveGoogleMetricsApiKey });
  useProjectStore.setState({ activeProjectId: 'one', projects: [] });
  const hook = renderHook(() => useSettingsHandlers());
  return { ...hook, saveDataForSeoCredentials, saveGoogleMetricsApiKey, verify, setApiKey };
}
