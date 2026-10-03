import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsModal } from '@/components/Settings/SettingsModal';
import { useSettingsStore } from '@/stores/settingsStore';

const previous = useSettingsStore.getState();
afterEach(() => useSettingsStore.setState(previous));

it('shows configuration failures as an alert and clears it after recovery', async () => {
  useSettingsStore.setState({
    configError: 'Configuration could not be read.',
    loadDataForSeoCredentials: vi.fn().mockResolvedValue(undefined),
    loadGoogleMetricsApiKey: vi.fn().mockResolvedValue(undefined),
  });
  render(<SettingsModal />);
  expect(screen.getByRole('alert').textContent).toContain('Configuration could not be read.');
  await act(async () => { useSettingsStore.setState({ configError: null }); });
  expect(screen.queryByRole('alert')).toBeNull();
});
