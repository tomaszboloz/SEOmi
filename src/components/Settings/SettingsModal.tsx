import React, { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useModalA11y } from '@/hooks/useModalA11y';

import { SettingsTabType } from './settings/settingsTypes';
import { useSettingsHandlers } from './settings/settingsHandlers';
import { SettingsHeader } from './settings/SettingsHeader';
import { SettingsTabBar } from './settings/SettingsTabBar';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { ApiSettingsTab } from './settings/ApiSettingsTab';
import { LanguageSettingsTab } from './settings/LanguageSettingsTab';
import { WorkspaceSettingsTab } from './settings/WorkspaceSettingsTab';
import { UpdatesSettingsTab } from './settings/UpdatesSettingsTab';

export const SettingsModal: React.FC = () => {
  const closeModal = useUIStore((s) => s.closeModal);
  const configError = useSettingsStore((s) => s.configError);
  const dialogRef = useModalA11y<HTMLDivElement>(closeModal);

  const [activeTab, setActiveTab] = useState<SettingsTabType>('general');

  const handlers = useSettingsHandlers();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" aria-describedby="settings-modal-description" tabIndex={-1} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <SettingsHeader />
        
        <SettingsTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

        {configError && (
          <div role="alert" className="mx-6 mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {configError}
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'general' && (
            <GeneralSettingsTab
              auditNotificationsEnabled={handlers.auditNotificationsEnabled}
              notificationStatus={handlers.notificationStatus}
              handleAuditNotificationsChange={handlers.handleAuditNotificationsChange}
            />
          )}

          {activeTab === 'api' && (
            <ApiSettingsTab
              dataforseoLogin={handlers.dataforseoLogin}
              setDataforseoLogin={handlers.setDataforseoLogin}
              dataforseoPass={handlers.dataforseoPass}
              setDataforseoPass={handlers.setDataforseoPass}
              testingDataForSeo={handlers.testingDataForSeo}
              dataForSeoTestStatus={handlers.dataForSeoTestStatus}
              handleTestDataForSeo={handlers.handleTestDataForSeo}
              googleMetricsKey={handlers.googleMetricsKey}
              setGoogleMetricsKey={handlers.setGoogleMetricsKey}
              handleAiKeyChange={handlers.handleAiKeyChange}
              handleSaveGeneral={handlers.handleSaveGeneral}
              savedSuccess={handlers.savedSuccess}
            />
          )}

          {activeTab === 'language' && <LanguageSettingsTab />}

          {activeTab === 'workspace' && (
            <WorkspaceSettingsTab
              activeProject={handlers.activeProject}
              backupStatus={handlers.backupStatus}
              backupFileInput={handlers.backupFileInput}
              handleExportProject={handlers.handleExportProject}
              handleImportProject={handlers.handleImportProject}
            />
          )}

          {activeTab === 'updates' && (
            <UpdatesSettingsTab
              updateStatus={handlers.updateStatus}
              updateError={handlers.updateError}
              checkingUpdates={handlers.checkingUpdates}
              installingUpdate={handlers.installingUpdate}
              handleCheckUpdates={handlers.handleCheckUpdates}
              handleInstallUpdate={handlers.handleInstallUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
};
