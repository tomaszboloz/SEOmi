import React from 'react';
import type { TFunction } from 'i18next';

interface Props {
  internalLinksCount: number;
  uniqueCount: number;
  checkedCount: number;
  brokenCount: number;
  uncheckedCount: number;
  t: TFunction;
}

export const CrawlLinksInternalSummary: React.FC<Props> = ({
  internalLinksCount,
  uniqueCount,
  checkedCount,
  brokenCount,
  uncheckedCount,
  t,
}) => {
  if (internalLinksCount === 0) return null;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <h3 className="text-xs font-semibold text-slate-200">
        {t('crawl.ui.internalTargetCheck')}
      </h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        {t('crawl.ui.internalTargetSummary', {
          unique: uniqueCount,
          checked: checkedCount,
          broken: brokenCount,
          unchecked: uncheckedCount,
        })}
      </p>
      {uncheckedCount > 0 ? (
        <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[10px] leading-4 text-amber-200">
          {t('crawl.ui.uncheckedTargetNote')}
        </p>
      ) : (
        <p className="mt-2 text-[10px] text-emerald-300">
          {t('crawl.ui.allInternalChecked')}
        </p>
      )}
    </section>
  );
};
