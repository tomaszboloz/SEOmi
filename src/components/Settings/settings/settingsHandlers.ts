import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invokeTauriCommand, type UpdateStatus } from '@/services/tauri';
import { DataForSEOClient } from '@/services/dataforseo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useToolsStore } from '@/stores/toolsStore';
import { areAuditNotificationsEnabled, disableAuditNotifications, enableAuditNotifications } from '@/services/desktopNotifications';
import { createProjectBackup, parseProjectBackup, restoreProjectBackup, serializeProjectBackup } from '@/services/projectBackup';
import { downloadBlob } from '@/services/download';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';

export const useSettingsHandlers = () => {
  const { t } = useTranslation();
  const dataForSeoCredentials = useSettingsStore((s) => s.dataForSeoCredentials);
  const googleMetricsApiKey = useSettingsStore((s) => s.googleMetricsApiKey);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const setApiKey = useAuthStore((s) => s.setApiKey);

  const [state, setState] = useState({
    dataforseoLogin: dataForSeoCredentials.login, dataforseoPass: dataForSeoCredentials.password,
    googleMetricsKey: googleMetricsApiKey, updateStatus: null as UpdateStatus | null, updateError: null as string | null,
    checkingUpdates: false, installingUpdate: false, savedSuccess: false, testingDataForSeo: false,
    dataForSeoTestStatus: null as string | null, auditNotificationsEnabled: false,
    notificationStatus: null as string | null, backupStatus: null as string | null
  });

  const updateState = (u: Partial<typeof state>) => setState(prev => ({ ...prev, ...u }));
  const backupFileInput = useRef<HTMLInputElement>(null);
  const beginCredentials = useAsyncOperationScope(activeProjectId);
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
    updateState({ notificationStatus: null });
    if (!enabled) { disableAuditNotifications(activeProjectId); updateState({ auditNotificationsEnabled: false }); return; }
    const granted = await enableAuditNotifications(activeProjectId);
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

  const handleCheckUpdates = async () => {
    updateState({ checkingUpdates: true, updateStatus: null, updateError: null });
    try { updateState({ updateStatus: await invokeTauriCommand<UpdateStatus>('check_for_updates') }); }
    catch (err: unknown) { updateState({ updateError: `${t('settings.updateError')}: ${String(err)}` }); }
    finally { updateState({ checkingUpdates: false }); }
  };

  const handleInstallUpdate = async () => {
    updateState({ installingUpdate: true, updateError: null });
    try { updateState({ updateStatus: await invokeTauriCommand<UpdateStatus>('install_update') }); }
    catch (err: unknown) { updateState({ updateError: `${t('settings.updateError')}: ${String(err)}` }); }
    finally { updateState({ installingUpdate: false }); }
  };

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

  const handleExportProject = async () => {
    if (!activeProject) return updateState({ backupStatus: t('legacyUi.settings.chooseProjectBackup') });
    updateState({ backupStatus: t('legacyUi.settings.preparingBackup') });
    try {
      const backup = await createProjectBackup(activeProject);
      const filename = `seomi-${activeProject.name.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || activeProject.id}-backup.json`;
      downloadBlob(filename, new Blob([serializeProjectBackup(backup)], { type: 'application/json' }));
      updateState({ backupStatus: t('legacyUi.settings.backupReady', { runs: backup.crawlRuns.length, entries: Object.keys(backup.localStorage).length }) });
    } catch (error) { updateState({ backupStatus: error instanceof Error ? t('legacyUi.settings.backupError', { error: error.message }) : t('legacyUi.settings.backupErrorGeneric') }); }
  };

  const handleImportProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    updateState({ backupStatus: t('legacyUi.settings.readingBackup') });
    try {
      const backup = parseProjectBackup(await file.text());
      const importedProject = useProjectStore.getState().createProject({ name: `${backup.project.name} (import)`.slice(0, 80), rootUrl: backup.project.rootUrl });
      const summary = await restoreProjectBackup(backup, importedProject.id);
      useProjectStore.getState().selectProject(importedProject.id);
      useAuditStore.getState().hydrateProject(importedProject.id);
      await useToolsStore.getState().hydrateProject(importedProject.id);
      await Promise.all([useSettingsStore.getState().loadDataForSeoCredentials(), useSettingsStore.getState().loadGoogleMetricsApiKey()]);
      updateState({ backupStatus: t('legacyUi.settings.restoredBackup', { name: importedProject.name, runs: summary.crawlRuns, entries: summary.storageEntries }) });
    } catch (error) { updateState({ backupStatus: error instanceof Error ? t('legacyUi.settings.restoreError', { error: error.message }) : t('legacyUi.settings.restoreErrorGeneric') }); }
  };

  return {
    ...state, setDataforseoLogin: (v: string) => updateCredentialDraft({ dataforseoLogin: v }),
    setDataforseoPass: (v: string) => updateCredentialDraft({ dataforseoPass: v }),
    setGoogleMetricsKey: (v: string) => updateCredentialDraft({ googleMetricsKey: v }),
    backupFileInput, activeProject, handleAuditNotificationsChange, handleSaveGeneral,
    handleAiKeyChange, handleCheckUpdates, handleInstallUpdate, handleTestDataForSeo,
    handleExportProject, handleImportProject
  };
};
