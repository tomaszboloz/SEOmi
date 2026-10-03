import React from 'react';
import type { TFunction } from 'i18next';
import { LoaderCircle } from 'lucide-react';
import type { CrawlRunRecord } from '@/types';

interface Props {
  externalLinksCount: number;
  checkedExternalCount: number;
  blockedExternalCount: number;
  invalidExternalCount: number;
  uncheckedExternalCount: number;
  isCheckingExternalLinks: boolean;
  externalLinkCheckProgress: { completed: number; total: number; currentUrl?: string } | null;
  externalLinkLimit: number;
  setExternalLinkLimit: (limit: number) => void;
  currentRun?: CrawlRunRecord;
  checkExternalLinks: (runId: string, limit: number, force?: boolean) => Promise<unknown>;
  externalError: string | null;
  t: TFunction;
}

export const CrawlLinksExternalCheck: React.FC<Props> = ({
  externalLinksCount,
  checkedExternalCount,
  blockedExternalCount,
  invalidExternalCount,
  uncheckedExternalCount,
  isCheckingExternalLinks,
  externalLinkCheckProgress,
  externalLinkLimit,
  setExternalLinkLimit,
  currentRun,
  checkExternalLinks,
  externalError,
  t,
}) => {
  if (externalLinksCount === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-xs font-semibold text-slate-200">
          {t('crawl.ui.externalTargetCheck')}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          {t('crawl.ui.externalTargetSummary', {
            checked: checkedExternalCount,
            blocked: blockedExternalCount,
            invalid: invalidExternalCount,
            unchecked: uncheckedExternalCount,
          })}
        </p>
        {isCheckingExternalLinks && externalLinkCheckProgress && (
          <p
            role="status"
            className="mt-1 max-w-xl truncate text-[11px] text-emerald-300"
          >
            {t('crawl.ui.liveProgress', {
              completed: externalLinkCheckProgress.completed,
              total: externalLinkCheckProgress.total,
            })}{' '}
            {externalLinkCheckProgress.currentUrl || t('crawl.ui.connecting')}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="text-[11px] text-slate-400">
          {t('crawl.ui.limit')}
          <select
            aria-label={t('crawl.ui.externalLinkLimit')}
            value={externalLinkLimit}
            onChange={(event) =>
              setExternalLinkLimit(Number(event.target.value))
            }
            className="ml-2 h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
          >
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!currentRun || isCheckingExternalLinks}
          onClick={() => {
            if (!currentRun) return;
            if (uncheckedExternalCount) {
              void checkExternalLinks(currentRun.id, externalLinkLimit);
            } else {
              void checkExternalLinks(currentRun.id, externalLinkLimit, true);
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isCheckingExternalLinks && (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          )}
          {isCheckingExternalLinks
            ? t('crawl.ui.checking')
            : t('crawl.ui.checkExternalLinks')}
        </button>
      </div>
      {externalError && (
        <p role="status" className="text-xs text-amber-300 sm:basis-full">
          {externalError}
        </p>
      )}
    </section>
  );
};
