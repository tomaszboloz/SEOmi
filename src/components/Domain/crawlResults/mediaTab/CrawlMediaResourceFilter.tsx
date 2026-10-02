import React from 'react';
import type { TFunction } from 'i18next';
import type { ResourceProvenanceFilter } from '../crawlResultsHelpers';

interface CrawlMediaResourceFilterProps {
  visibleCount: number;
  totalCount: number;
  resourceLimitReached?: boolean;
  filter: ResourceProvenanceFilter;
  onFilterChange: (filter: ResourceProvenanceFilter) => void;
  t: TFunction;
}

export const CrawlMediaResourceFilter: React.FC<CrawlMediaResourceFilterProps> = ({
  visibleCount,
  totalCount,
  resourceLimitReached,
  filter,
  onFilterChange,
  t,
}) => {
  const options: Array<[ResourceProvenanceFilter, string]> = [
    ['all', t('crawl.ui.all')],
    ['orphaned', t('crawl.ui.orphaned')],
    ['partial', t('crawl.ui.partialEvidence')],
    ['unknown', t('crawl.ui.noEvidence')],
  ];

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('crawl.ui.httpResources', {
          visible: visibleCount,
          total: totalCount,
        })}
      </h3>
      {resourceLimitReached ? (
        <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
          {t('siteAudit.resourceLimitReached')}
        </span>
      ) : null}
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label={t('crawl.ui.resourceProvenanceFilter')}
      >
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
            className={`rounded-md border px-2 py-1 text-[10px] transition ${
              filter === value
                ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
