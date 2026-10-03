import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, Loader2 } from 'lucide-react';
import { type UpdateStatus, isTauriEnvironment } from '@/services/tauri';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdatesSettingsTabProps {
  updateStatus: UpdateStatus | null;
  updateError: string | null;
  checkingUpdates: boolean;
  installingUpdate: boolean;
  handleCheckUpdates: () => void;
  handleInstallUpdate: () => void;
}

export const UpdatesSettingsTab: React.FC<UpdatesSettingsTabProps> = ({
  updateStatus, updateError, checkingUpdates, installingUpdate,
  handleCheckUpdates, handleInstallUpdate
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-xs">
      <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <span className="font-semibold text-white block mb-0.5">{t('legacyUi.settings.installedVersion')}</span>
          <span className="text-slate-400 font-mono">{t('legacyUi.settings.releaseVersion')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCheckUpdates}
            disabled={checkingUpdates || installingUpdate}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition flex items-center space-x-1.5 border border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingUpdates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{t('legacyUi.settings.checkUpdates')}</span>
          </button>
          {updateStatus?.available && !updateStatus.installed && (
            <button
              type="button"
              onClick={handleInstallUpdate}
              disabled={installingUpdate || !isTauriEnvironment()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition flex items-center space-x-1.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {installingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{t('legacyUi.settings.installUpdate')}</span>
            </button>
          )}
        </div>
      </div>

      {updateStatus && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl">
          {updateStatus.installed
            ? <span>{t('legacyUi.settings.updateInstalled', { version: updateStatus.version || '' })}</span>
            : updateStatus.available
              ? <span>{t('legacyUi.settings.updateAvailable', { version: updateStatus.version || '' })}</span>
              : <span>{t('legacyUi.settings.upToDate', { version: updateStatus.current_version })}</span>}
        </div>
      )}
      
      {updateStatus?.restart_required && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
          <span>{t('legacyUi.settings.restartRequired')}</span>
          <button type="button" onClick={() => void relaunch()} className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-amber-300">{t('legacyUi.settings.restartNow')}</button>
        </div>
      )}
      
      {updateError && (
        <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">{updateError}</div>
      )}
    </div>
  );
};
