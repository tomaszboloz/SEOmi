import { act, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';
import { settingsHandlersHook } from './fixtures/settingsHandlersHook';

it('redacts stored presence markers from every settings draft field', async () => {
  const f = settingsHandlersHook();
  act(() => useSettingsStore.setState({
    dataForSeoCredentials: { login: '__seomi_secret_present__', password: '__seomi_secret_present__' },
    googleMetricsApiKey: '__seomi_secret_present__',
  }));
  await waitFor(() => {
    expect(f.result.current.dataforseoLogin).toBe('');
    expect(f.result.current.dataforseoPass).toBe('');
    expect(f.result.current.googleMetricsKey).toBe('');
  });
});
