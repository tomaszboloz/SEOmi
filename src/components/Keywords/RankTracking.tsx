import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRankTrackingSession } from './rankTracking/useRankTrackingSession';
import { RankTrackingHeader } from './rankTracking/RankTrackingHeader';
import { RankTrackingStatsCards } from './rankTracking/RankTrackingStatsCards';
import { RankTrackingTable } from './rankTracking/RankTrackingTable';
import { RankTrackingAddModal } from './rankTracking/RankTrackingAddModal';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';

export { normalizeRankTrackingMarketDraft } from './rankTracking/rankTrackingTypes';

export const RankTracking: React.FC = () => {
  const { t } = useTranslation();
  const {
    trackedRanks,
    isRankLoading,
    rankError,
    rankTrackingDraft,
    setRankTrackingDraft,
    removeTrackedRank,
    refreshAllRanks,
    showAddModal,
    setShowAddModal,
    selectedMarket,
    totalTracked,
    measuredRanks,
    inTop3,
    inTop10,
    avgPosition,
    handleAddRank,
  } = useRankTrackingSession();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <DataForSeoCostMeter />
      <RankTrackingHeader
        totalTracked={totalTracked}
        isRankLoading={isRankLoading}
        onRefreshAll={refreshAllRanks}
        onOpenAddModal={() => setShowAddModal(true)}
        t={t}
      />

      {rankError && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-300">
          {rankError}
        </div>
      )}

      <RankTrackingStatsCards
        totalTracked={totalTracked}
        measuredCount={measuredRanks.length}
        inTop3={inTop3}
        inTop10={inTop10}
        avgPosition={avgPosition}
        t={t}
      />

      <RankTrackingTable
        trackedRanks={trackedRanks}
        onRemove={removeTrackedRank}
        t={t}
      />

      <RankTrackingAddModal
        isOpen={showAddModal}
        draft={rankTrackingDraft}
        selectedMarket={selectedMarket}
        onUpdateDraft={setRankTrackingDraft}
        onSubmit={handleAddRank}
        onClose={() => setShowAddModal(false)}
        t={t}
      />
    </div>
  );
};
