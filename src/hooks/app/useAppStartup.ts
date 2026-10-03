import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { invokeTauriCommand, isTauriEnvironment, type UpdateStatus } from '@/services/tauri';
import { connectSettingsStores } from '@/services/settingsComposition';

export const useAppStartup = () => {
  const loadConfig = useSettingsStore(s => s.loadConfig);
  const autoCheckUpdates = useSettingsStore(s => s.config.auto_check_updates);
  const autoInstallUpdates = useSettingsStore(s => s.config.auto_install_updates);
  useEffect(() => {
    const disconnect = connectSettingsStores();
    loadConfig();
    return disconnect;
  }, [loadConfig]);
  useEffect(() => {
    if (!isTauriEnvironment() || !autoCheckUpdates) return;
    let disposed = false;
    const timer = window.setTimeout(() => {
      void invokeTauriCommand<UpdateStatus>('check_for_updates').then(async (status) => {
        if (disposed || !status.available || !autoInstallUpdates) return;
        const installed = await invokeTauriCommand<UpdateStatus>('install_update').catch(() => null);
        if (disposed || !installed?.installed) return;
        window.dispatchEvent(new CustomEvent('seomi-update-installed', { detail: installed }));
      }).catch(() => undefined);
    }, 3500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [autoCheckUpdates, autoInstallUpdates]);
};
