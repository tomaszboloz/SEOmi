import React from 'react';
import type { Session } from './validationTabTypes';

interface ValidationFilterBarProps {
  validationQuery: string;
  setValidationQuery: (query: string) => void;
  validationSeverity: 'all' | 'Error' | 'Warning';
  setValidationSeverity: (severity: 'all' | 'Error' | 'Warning') => void;
  pagesCount: number;
  findingsCount: number;
  t: Session['t'];
}

export const ValidationFilterBar: React.FC<ValidationFilterBarProps> = ({
  validationQuery,
  setValidationQuery,
  validationSeverity,
  setValidationSeverity,
  pagesCount,
  findingsCount,
  t,
}) => {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
      <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {t('crawlDeepUi.searchEvidence')}
        <input
          aria-label={t('crawl.ui.searchHtmlValidation')}
          value={validationQuery}
          onChange={(event) => setValidationQuery(event.target.value)}
          placeholder={t('crawl.ui.searchHtmlValidationPlaceholder')}
          className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-emerald-400"
        />
      </label>
      <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {t('crawl.ui.severity')}
        <select
          aria-label={t('crawl.ui.validationSeverity')}
          value={validationSeverity}
          onChange={(event) =>
            setValidationSeverity(event.target.value as 'all' | 'Error' | 'Warning')
          }
          className="mt-1 h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-emerald-400"
        >
          <option value="all">{t('crawl.ui.all')}</option>
          <option value="Error">{t('crawl.ui.error')}</option>
          <option value="Warning">{t('crawl.ui.warning')}</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          setValidationQuery('');
          setValidationSeverity('all');
        }}
        disabled={!validationQuery && validationSeverity === 'all'}
        className="h-8 rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t('crawlDeepUi.clearFilter')}
      </button>
      <p className="text-[10px] text-slate-500 sm:col-span-3">
        {t('crawlDeepUi.matchedFindings', {
          pages: pagesCount,
          findings: findingsCount,
        })}
      </p>
    </div>
  );
};
