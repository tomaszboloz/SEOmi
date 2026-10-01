import { useSettingsStore } from '../../src/stores/settingsStore';

export const originalConfig = useSettingsStore.getState().config;
