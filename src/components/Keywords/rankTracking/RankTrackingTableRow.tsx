import React from 'react';
import { ArrowDownRight, ArrowUpRight, Globe, Minus, Trash2 } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { TrackedRankItem } from '@/types';
import { TrendChart } from '@/components/Charts/TrendChart';
import {
  resolveDataForSeoMarket,
  dataForSeoMarketLabel,
  dataForSeoLanguageLabel,
} from '@/services/dataforseo';

interface RankTrackingTableRowProps {
  rank: TrackedRankItem;
  onRemove: (id: string) => void;
  t: TFunction;
}

const renderDelta = (delta: number | null) => {
  if (delta === null) return <span className="text-xs text-slate-500">—</span>;
  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />{delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
      <Minus className="w-3 h-3 mr-0.5" />0
    </span>
  );
};

export const RankTrackingTableRow: React.FC<RankTrackingTableRowProps> = ({
  rank: r,
  onRemove,
  t,
}) => {
  const resolvedMarket = resolveDataForSeoMarket(r.location);
  const locationLabel = resolvedMarket ? dataForSeoMarketLabel(resolvedMarket) : r.location;
  const languageLabel = r.language_code ? dataForSeoLanguageLabel({ code: r.language_code }) : '—';

  return (
    <tr className="hover:bg-slate-800/40 transition">
      <td className="px-4 py-3.5 font-medium text-white">
        <span className="hover:text-emerald-400 transition cursor-pointer">{r.keyword}</span>
      </td>
      <td className="px-4 py-3.5">
        <div className="text-xs text-slate-300 font-mono">{r.domain}</div>
        <div className="text-[11px] text-slate-500 truncate max-w-xs">{r.target_url}</div>
      </td>
      <td className="px-4 py-3.5 text-xs text-slate-400 flex items-center space-x-1 mt-1">
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <span>{locationLabel} · {languageLabel}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span
          className={`text-sm px-2.5 py-1 rounded-lg font-bold font-mono border ${
            r.current_rank !== null && r.current_rank <= 3
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : r.current_rank !== null && r.current_rank <= 10
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {r.current_rank !== null
            ? (r.current_rank > 100 ? t('rankTrackingUi.outsideTop100', 'Outside top 100') : `#${r.current_rank}`)
            : t('rankTrackingUi.notChecked')}
        </span>
      </td>
      <td className="px-4 py-3.5 text-center">{renderDelta(r.delta)}</td>
      <td className="px-4 py-3.5 text-center text-xs font-mono text-slate-400">
        {r.best_rank !== null ? `#${r.best_rank}` : '—'}
      </td>
      <td className="px-4 py-3.5">
        <div className="w-28">
          <TrendChart
            values={r.history.map((point) => point.rank)}
            label={t('rankTrackingUi.historyAria', { keyword: r.keyword })}
            invert
          />
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <button
          type="button"
          onClick={() => onRemove(r.id)}
          className="p-1.5 rounded hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition"
          title={t('rankTrackingUi.removeTracking')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
