import React from 'react';
import type { TFunction } from 'i18next';
import { crawlErrorLabel } from '@/services/crawlErrors';

interface CrawlUrlsFilterBarProps {
  onlyProblems: boolean;
  setOnlyProblems: (value: boolean) => void;
  severity: string;
  setSeverity: (severity: 'all' | 'Critical' | 'Warning' | 'Info') => void;
  activeErrorKind: string;
  setErrorKind: (kind: string) => void;
  errorKinds: string[];
  filteredCount: number;
  totalCount: number;
  t: TFunction;
}

export const CrawlUrlsFilterBar: React.FC<CrawlUrlsFilterBarProps> = ({
  onlyProblems,
  setOnlyProblems,
  severity,
  setSeverity,
  activeErrorKind,
  setErrorKind,
  errorKinds,
  filteredCount,
  totalCount,
  t,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={onlyProblems}
          onChange={(event) => setOnlyProblems(event.target.checked)}
          className="accent-emerald-400"
        />
        {t('crawl.ui.onlyProblems')}
      </label>
      <span className="text-xs text-slate-400">{t('crawl.ui.severity')}:</span>
      {(['all', 'Critical', 'Warning', 'Info'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setSeverity(value)}
          aria-pressed={severity === value}
          className={`rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            severity === value
              ? 'bg-emerald-500/20 font-medium text-emerald-300'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {value === 'all'
            ? t('crawl.ui.all')
            : t(`crawl.ui.severityValues.${value.toLowerCase()}`)}
        </button>
      ))}
      <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
        {t('crawl.ui.errorType')}
        <select
          aria-label={t('crawl.ui.errorTypeAria')}
          value={activeErrorKind}
          onChange={(event) => setErrorKind(event.target.value)}
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-emerald-400"
        >
          <option value="all">{t('crawl.ui.all')}</option>
          {errorKinds.map((kind) => (
            <option key={kind} value={kind}>
              {crawlErrorLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-slate-500">
        {filteredCount} / {totalCount}
      </span>
    </div>
  );
};
