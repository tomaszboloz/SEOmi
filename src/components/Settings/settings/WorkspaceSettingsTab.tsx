import React from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Download, Upload, ShieldCheck } from 'lucide-react';
import type { SeoProject } from '@/types';

interface WorkspaceSettingsTabProps {
  activeProject: SeoProject | null;
  backupStatus: string | null;
  backupFileInput: React.RefObject<HTMLInputElement | null>;
  handleExportProject: () => void;
  handleImportProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const WorkspaceSettingsTab: React.FC<WorkspaceSettingsTabProps> = ({
  activeProject, backupStatus, backupFileInput, handleExportProject, handleImportProject
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <h4 className="font-bold text-white">{t('legacyUi.settings.backupTitle')}</h4>
            <p className="mt-1 leading-5 text-slate-400">{t('legacyUi.settings.backupDescriptionLong')}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportProject}
            disabled={!activeProject}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {t('legacyUi.settings.backupExport')}
          </button>
          <button
            type="button"
            onClick={() => backupFileInput.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
          >
            <Upload className="h-4 w-4" />
            {t('legacyUi.settings.backupImport')}
          </button>
          <input
            ref={backupFileInput}
            type="file"
            accept="application/json,.json"
            onChange={handleImportProject}
            className="sr-only"
            aria-label={t('legacyUi.settings.backupFile')}
          />
        </div>
        {backupStatus && <p role="status" className="mt-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 leading-5 text-slate-300">{backupStatus}</p>}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-slate-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p className="leading-5">{t('legacyUi.settings.backupSafety')}</p>
      </div>
    </div>
  );
};
