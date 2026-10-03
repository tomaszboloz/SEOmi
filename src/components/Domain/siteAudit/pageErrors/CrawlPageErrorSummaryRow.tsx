import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';

interface CrawlPageErrorSummaryRowProps {
  page: CrawledPageSummary;
  isExpanded: boolean;
  onToggle: (url: string) => void;
  t: TFunction;
}

export const CrawlPageErrorSummaryRow: React.FC<CrawlPageErrorSummaryRowProps> = ({
  page,
  isExpanded,
  onToggle,
  t,
}) => {
  return (
    <tr
      onClick={() => onToggle(page.url)}
      className="hover:bg-slate-800/40 cursor-pointer transition"
    >
      <td className="px-4 py-3 text-slate-500">
        {page.issues.length > 0 &&
          (isExpanded ? (
            <ChevronDown className="w-4 h-4 text-emerald-400" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          ))}
      </td>
      <td className="px-4 py-3 max-w-md">
        <div className="font-medium text-slate-200 truncate">
          {page.title || t('siteAudit.noTitle')}
        </div>
        <div className="text-[11px] text-slate-500 font-mono truncate">
          {page.url}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
            page.http_status === 200
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {page.http_status}
        </span>
      </td>
      <td className="px-4 py-3 text-center font-mono text-slate-400">
        {page.depth}
      </td>
      <td className="px-4 py-3 text-center font-mono text-slate-300">
        {page.h1_count}
      </td>
      <td className="px-4 py-3 text-right font-mono text-slate-400">
        {page.response_time_ms} {t('performance.milliseconds')}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
            page.issues.length === 0
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {t('crawl.ui.issueCount', {
            count: page.issues.length,
          })}
        </span>
      </td>
    </tr>
  );
};
