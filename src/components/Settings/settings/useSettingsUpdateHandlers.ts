import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invokeTauriCommand, type UpdateStatus } from '@/services/tauri';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';

export const useSettingsUpdateHandlers = () => {
  const { t } = useTranslation();
  const beginOperation = useAsyncOperationScope(null);
  const [state, setState] = useState({ updateStatus: null as UpdateStatus | null,
    updateError: null as string | null, checkingUpdates: false, installingUpdate: false });
  const runUpdate = async (kind: 'check' | 'install') => {
    const isCurrent = beginOperation(kind);
    const ownsResult = beginOperation('result');
    const flag = kind === 'check' ? 'checkingUpdates' : 'installingUpdate';
    setState(prev => ({ ...prev, [flag]: true, updateError: null, ...(kind === 'check' ? { updateStatus: null } : {}) }));
    try {
      const updateStatus = await invokeTauriCommand<UpdateStatus>(kind === 'check' ? 'check_for_updates' : 'install_update');
      if (ownsResult()) setState(prev => ({ ...prev, updateStatus }));
    } catch (error) {
      if (ownsResult()) setState(prev => ({ ...prev, updateError: `${t('settings.updateError')}: ${String(error)}` }));
    } finally {
      if (isCurrent()) setState(prev => ({ ...prev, [flag]: false }));
    }
  };
  return { ...state, handleCheckUpdates: () => runUpdate('check'), handleInstallUpdate: () => runUpdate('install') };
};
