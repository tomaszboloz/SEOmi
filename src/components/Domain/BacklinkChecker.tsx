import React from 'react';
import { useBacklinkSession } from './backlinkChecker/useBacklinkSession';
import { BacklinkHeader } from './backlinkChecker/BacklinkHeader';
import { BacklinkGapSection } from './backlinkChecker/BacklinkGapSection';
import { BacklinkMetricsGrid } from './backlinkChecker/BacklinkMetricsGrid';
import { BacklinkEquityAndAnchors } from './backlinkChecker/BacklinkEquityAndAnchors';
import { BacklinkInboundTable } from './backlinkChecker/BacklinkInboundTable';

export const BacklinkChecker: React.FC = () => {
  const session = useBacklinkSession();
  const {
    t,
    backlinkProfile,
    backlinkProfileHistory,
    isLoading,
    error,
    loadMoreBacklinks,
    loadMoreBacklinkAnchors,
  } = session;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <BacklinkHeader session={session} />
      <BacklinkGapSection session={session} />

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {backlinkProfile && (
        <div className="space-y-8">
          <BacklinkMetricsGrid
            profile={backlinkProfile}
            history={backlinkProfileHistory}
            t={t}
          />
          <BacklinkEquityAndAnchors
            profile={backlinkProfile}
            isLoading={isLoading}
            loadMoreBacklinkAnchors={loadMoreBacklinkAnchors}
            t={t}
          />
          <BacklinkInboundTable
            profile={backlinkProfile}
            isLoading={isLoading}
            loadMoreBacklinks={loadMoreBacklinks}
            t={t}
          />
        </div>
      )}
    </div>
  );
};
