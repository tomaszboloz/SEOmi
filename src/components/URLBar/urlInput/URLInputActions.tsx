import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, ArrowRight, RotateCcw, FileUp } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';
import { UserAgentSelector } from '../UserAgentSelector';

interface URLInputActionsProps {
  url: string;
  isLoading: boolean;
  onReAudit: () => void;
  hasCurrentAudit: boolean;
}

export const URLInputActions: React.FC<URLInputActionsProps> = ({
  url,
  isLoading,
  onReAudit,
  hasCurrentAudit,
}) => {
  const { t } = useTranslation();
  const csvInput = useRef<HTMLInputElement>(null);
  const isBatchRunning = useAuditStore((s) => s.isBatchRunning);
  const importAuditCsv = useAuditStore((s) => s.importAuditCsv);

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importAuditCsv(await file.text());
    event.target.value = '';
  };

  return (
    <>
      <UserAgentSelector />

      <input
        ref={csvInput}
        onChange={handleCsvImport}
        accept=".csv,text/csv"
        type="file"
        className="hidden"
        aria-label={t('legacyUi.url.csvImportAria')}
      />
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

      {hasCurrentAudit && (
        <button
          type="button"
          onClick={onReAudit}
          disabled={isLoading}
          className="h-10 px-3 bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-300 hover:text-white rounded-lg transition flex items-center space-x-1 text-xs shrink-0 disabled:opacity-50"
          title={t('legacyUi.url.reauditTitle')}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      )}
    </>
  );
};
