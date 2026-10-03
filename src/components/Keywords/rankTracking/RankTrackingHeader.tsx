import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { TFunction } from 'i18next';

interface RankTrackingHeaderProps {
  totalTracked: number;
  isRankLoading: boolean;
  onRefreshAll: () => void;
  onOpenAddModal: () => void;
  t: TFunction;
}

export const RankTrackingHeader: React.FC<RankTrackingHeaderProps> = ({
  totalTracked,
  isRankLoading,
  onRefreshAll,
  onOpenAddModal,
  t,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {t('rankTrackingUi.badge')}
          </span>
          <span className="text-xs text-slate-400 font-mono">{t('rankTrackingUi.provider')}</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">{t('rankTrackingUi.title')}</h1>
        <p className="text-sm text-slate-400">
          {t('rankTrackingUi.description')}
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <p className="text-xs text-amber-200">
          {t('dataforseo.paidRequests', { count: totalTracked })}
        </p>
        <button
          type="button"
          onClick={onRefreshAll}
          disabled={isRankLoading}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRankLoading ? 'animate-spin' : ''}`} />
          <span>{isRankLoading ? t('rankTrackingUi.updating') : t('rankTrackingUi.checkAll')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('rankTrackingUi.trackKeyword')}</span>
        </button>
      </div>
    </div>
  );
};
