import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, ArrowRight, RotateCcw, FileUp } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';
import { UserAgentSelector } from './UserAgentSelector';
import { BatchAuditQueue } from './BatchAuditQueue';
import { UrlField } from './UrlField';

const auditUrlDraftKey = (projectId: string) => `seomi_project_${projectId}_audit_url_draft_v1`;

export const URLInput: React.FC = () => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projectRootUrl = useProjectStore((state) => state.projects.find((project) => project.id === state.activeProjectId)?.rootUrl || '');
  const startAudit = useAuditStore((s) => s.startAudit);
  const isLoading = useAuditStore((s) => s.isLoading);
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const isBatchRunning = useAuditStore((s) => s.isBatchRunning);
  const importAuditCsv = useAuditStore((s) => s.importAuditCsv);
  const csvInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setUrl('');
      return;
    }
    const savedDraft = readStorage(auditUrlDraftKey(activeProjectId));
    setUrl(savedDraft !== null ? savedDraft : projectRootUrl);
  }, [activeProjectId, projectRootUrl]);

  const updateUrl = (value: string) => {
    setUrl(value);
    if (activeProjectId) writeStorage(auditUrlDraftKey(activeProjectId), value.slice(0, 2048));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    startAudit(url.trim());
  };

  const handleReAudit = () => {
    if (currentAudit?.url) {
      startAudit(currentAudit.url);
    }
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importAuditCsv(await file.text());
    event.target.value = '';
  };

  return (
    <div className="bg-slate-950/60 border-b border-slate-800/80 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-6xl mx-auto">
        <UrlField url={url} isLoading={isLoading} updateUrl={updateUrl} />

        {/* User Agent preset selector */}
        <UserAgentSelector />

        <input ref={csvInput} onChange={handleCsvImport} accept=".csv,text/csv" type="file" className="hidden" aria-label={t('legacyUi.url.csvImportAria')} />
        <button
          type="button"
          onClick={() => csvInput.current?.click()}
          disabled={isLoading || isBatchRunning}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          title={t('legacyUi.url.csvImportTitle')}
        >
          <FileUp className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden xl:inline">{t('legacyUi.url.csv')}</span>
        </button>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!url.trim() || isLoading}
          aria-label={t('urlBar.analyze')}
          className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-600/30 transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">{t('urlBar.analyzing')}</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">{t('urlBar.analyze')}</span>
              <ArrowRight className="w-3.5 h-3.5 sm:hidden" />
            </>
          )}
        </button>

        {/* Re-audit button if current audit exists */}
        {currentAudit && (
          <button
            type="button"
            onClick={handleReAudit}
            disabled={isLoading}
            className="h-10 px-3 bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-300 hover:text-white rounded-lg transition flex items-center space-x-1 text-xs shrink-0 disabled:opacity-50"
            title={t('legacyUi.url.reauditTitle')}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </form>
      <BatchAuditQueue />
    </div>
  );
};
