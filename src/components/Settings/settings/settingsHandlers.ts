import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DataForSEOClient } from '@/services/dataforseo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { areAuditNotificationsEnabled, disableAuditNotifications, enableAuditNotifications } from '@/services/desktopNotifications';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import { useSettingsUpdateHandlers } from './useSettingsUpdateHandlers';
import { useSettingsBackupHandlers } from './useSettingsBackupHandlers';

export const useSettingsHandlers = () => {
  const { t } = useTranslation();
  const updates = useSettingsUpdateHandlers();
  const backups = useSettingsBackupHandlers();
  const dataForSeoCredentials = useSettingsStore((s) => s.dataForSeoCredentials);
  const googleMetricsApiKey = useSettingsStore((s) => s.googleMetricsApiKey);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setApiKey = useAuthStore((s) => s.setApiKey);

  const [state, setState] = useState({
    dataforseoLogin: dataForSeoCredentials.login, dataforseoPass: dataForSeoCredentials.password,
    googleMetricsKey: googleMetricsApiKey, savedSuccess: false, testingDataForSeo: false,
    dataForSeoTestStatus: null as string | null, auditNotificationsEnabled: false,
    notificationStatus: null as string | null
  });

  const updateState = (u: Partial<typeof state>) => setState(prev => ({ ...prev, ...u }));
  const beginCredentials = useAsyncOperationScope(activeProjectId);
  const beginNotifications = useAsyncOperationScope(activeProjectId);
  const updateCredentialDraft = (patch: Partial<typeof state>) => {
    beginCredentials('save'); beginCredentials('test');
    updateState({ ...patch, savedSuccess: false, testingDataForSeo: false, dataForSeoTestStatus: null });
  };
  useEffect(() => {
    updateState({ savedSuccess: false, testingDataForSeo: false, dataForSeoTestStatus: null });
  }, [activeProjectId]);

  useEffect(() => { updateState({ googleMetricsKey: googleMetricsApiKey }); }, [googleMetricsApiKey, activeProjectId]);
  useEffect(() => {
    beginCredentials('test');
    updateState({ dataforseoLogin: dataForSeoCredentials.login, dataforseoPass: dataForSeoCredentials.password, testingDataForSeo: false, dataForSeoTestStatus: null });
  }, [activeProjectId, dataForSeoCredentials.login, dataForSeoCredentials.password, beginCredentials]);
  useEffect(() => {
    updateState({ auditNotificationsEnabled: activeProjectId ? areAuditNotificationsEnabled(activeProjectId) : false, notificationStatus: null });
  }, [activeProjectId]);

  const handleAuditNotificationsChange = async (enabled: boolean) => {
    if (!activeProjectId) return;
    const isCurrent = beginNotifications("notifications");
    updateState({ notificationStatus: null });
    if (!enabled) { disableAuditNotifications(activeProjectId); updateState({ auditNotificationsEnabled: false }); return; }
    const granted = await enableAuditNotifications(activeProjectId);
    if (!isCurrent()) return;
    updateState({ auditNotificationsEnabled: granted, notificationStatus: granted ? t('settings.notificationsEnabled') : t('settings.notificationsDenied') });
  };

  const handleSaveGeneral = async (e: React.SyntheticEvent) => {
    e.preventDefault(); updateState({ savedSuccess: false });
    if (!activeProjectId) return;
    const isCurrent = beginCredentials('save');
    try {
      await useSettingsStore.getState().saveDataForSeoCredentials({ login: state.dataforseoLogin, password: state.dataforseoPass });
      if (!isCurrent()) return;
      await useSettingsStore.getState().saveGoogleMetricsApiKey(state.googleMetricsKey);
      if (!isCurrent()) return;
      updateState({ savedSuccess: true });
      setTimeout(() => { if (isCurrent()) updateState({ savedSuccess: false }); }, 2000);
    } catch {}
  };

  const handleAiKeyChange = (provider: 'openai' | 'claude' | 'gemini', value: string) => void setApiKey(provider, value).catch(() => undefined);

  const handleTestDataForSeo = async () => {
    const isCurrent = beginCredentials('test');
    if (!state.dataforseoLogin.trim() || !state.dataforseoPass) return updateState({ dataForSeoTestStatus: t('dataforseo.enterCredentials') });
    updateState({ testingDataForSeo: true, dataForSeoTestStatus: null });
    try {
      await new DataForSEOClient(state.dataforseoLogin.trim(), state.dataforseoPass).verifyCredentials();
      if (isCurrent()) updateState({ dataForSeoTestStatus: t('dataforseo.connectionConfirmed') });
    } catch (error) { if (isCurrent()) updateState({ dataForSeoTestStatus: error instanceof Error ? t('dataforseo.connectionFailed', { error: error.message }) : t('dataforseo.connectionFailed', { error: t('auditProblems.unknown') }) });
    } finally { if (isCurrent()) updateState({ testingDataForSeo: false }); }
  };

  return {
    ...state, ...updates, ...backups, setDataforseoLogin: (v: string) => updateCredentialDraft({ dataforseoLogin: v }),
    setDataforseoPass: (v: string) => updateCredentialDraft({ dataforseoPass: v }),
    setGoogleMetricsKey: (v: string) => updateCredentialDraft({ googleMetricsKey: v }),
    handleAuditNotificationsChange, handleSaveGeneral,
    handleAiKeyChange, handleTestDataForSeo,
  };
};
