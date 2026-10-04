import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createProjectBackup, parseProjectBackup, restoreProjectBackup, serializeProjectBackup } from '@/services/projectBackup';
import { downloadBlob } from '@/services/download';
import { useSettingsBackupScope } from './useSettingsBackupScope';

export const useSettingsBackupHandlers = () => {
  const { t } = useTranslation();
  const projectId = useProjectStore(s => s.activeProjectId);
  const projects = useProjectStore(s => s.projects);
  const activeProject = projects.find(project => project.id === projectId) || null;
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const backupFileInput = useRef<HTMLInputElement>(null);
  const beginBackup = useSettingsBackupScope(projectId, setBackupStatus);
  const handleExportProject = async () => {
    if (!activeProject) return setBackupStatus(t('legacyUi.settings.chooseProjectBackup'));
    const operation = beginBackup();
    setBackupStatus(t('legacyUi.settings.preparingBackup'));
    try {
      const backup = await createProjectBackup(activeProject);
      if (!operation.isCurrent()) return;
      const filename = `seomi-${activeProject.name.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || activeProject.id}-backup.json`;
      downloadBlob(filename, new Blob([serializeProjectBackup(backup)], { type: 'application/json' }));
      setBackupStatus(t('legacyUi.settings.backupReady', { runs: backup.crawlRuns.length, entries: Object.keys(backup.localStorage).length }));
    } catch (error) {
      if (operation.isCurrent()) setBackupStatus(error instanceof Error ? t('legacyUi.settings.backupError', { error: error.message }) : t('legacyUi.settings.backupErrorGeneric'));
    }
  };
  const handleImportProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const operation = beginBackup();
    setBackupStatus(t('legacyUi.settings.readingBackup'));
    try {
      const content = await file.text();
      if (!operation.isCurrent()) return;
      const backup = parseProjectBackup(content);
      const project = useProjectStore.getState().createProject({ name: `${backup.project.name} (import)`.slice(0, 80), rootUrl: backup.project.rootUrl, activate: false });
      const summary = await restoreProjectBackup(backup, project.id);
      if (!operation.isCurrent()) return;
      operation.selectProject(project.id);
      useAuditStore.getState().hydrateProject(project.id);
      await useToolsStore.getState().hydrateProject(project.id);
      if (!operation.isCurrent()) return;
      await Promise.all([useSettingsStore.getState().loadDataForSeoCredentials(), useSettingsStore.getState().loadGoogleMetricsApiKey()]);
      if (operation.isCurrent()) setBackupStatus(t('legacyUi.settings.restoredBackup', { name: project.name, runs: summary.crawlRuns, entries: summary.storageEntries }));
    } catch (error) {
      if (operation.isCurrent()) setBackupStatus(error instanceof Error ? t('legacyUi.settings.restoreError', { error: error.message }) : t('legacyUi.settings.restoreErrorGeneric'));
    }
  };
  return { backupStatus, backupFileInput, activeProject, handleExportProject, handleImportProject };
};
