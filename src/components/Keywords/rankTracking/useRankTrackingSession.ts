import React, { useState } from 'react';
import { useToolsStore } from '@/stores/toolsStore';
import { resolveDataForSeoMarket } from '@/services/dataforseo';

export const useRankTrackingSession = () => {
  const trackedRanks = useToolsStore((s) => s.trackedRanks);
  const isRankLoading = useToolsStore((s) => s.isRankLoading);
  const rankError = useToolsStore((s) => s.rankError);
  const rankTrackingDraft = useToolsStore((s) => s.rankTrackingDraft);
  const setRankTrackingDraft = useToolsStore((s) => s.setRankTrackingDraft);
  const addTrackedRank = useToolsStore((s) => s.addTrackedRank);
  const removeTrackedRank = useToolsStore((s) => s.removeTrackedRank);
  const refreshAllRanks = useToolsStore((s) => s.refreshAllRanks);

  const [showAddModal, setShowAddModal] = useState(false);
  const selectedMarket = resolveDataForSeoMarket(rankTrackingDraft.location) || undefined;

  const totalTracked = trackedRanks.length;
  const measuredRanks = trackedRanks.filter(
    (r): r is typeof r & { current_rank: number } => r.current_rank !== null,
  );
  const inTop3 = measuredRanks.filter((r) => r.current_rank <= 3).length;
  const inTop10 = measuredRanks.filter((r) => r.current_rank <= 10).length;
  const avgPosition =
    measuredRanks.length > 0
      ? (measuredRanks.reduce((acc, r) => acc + r.current_rank, 0) / measuredRanks.length).toFixed(1)
      : '—';

  const handleAddRank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rankTrackingDraft.keyword.trim() || !rankTrackingDraft.domain.trim()) return;
    addTrackedRank(
      rankTrackingDraft.keyword,
      rankTrackingDraft.domain,
      rankTrackingDraft.targetUrl,
      rankTrackingDraft.location,
      rankTrackingDraft.language,
    );
    setRankTrackingDraft({ keyword: '' });
    setShowAddModal(false);
  };

  return {
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
  };
};
