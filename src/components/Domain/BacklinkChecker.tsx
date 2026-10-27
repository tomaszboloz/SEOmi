import React, { useMemo } from 'react';
import { useBacklinkSession } from './backlinkChecker/useBacklinkSession';
import { BacklinkHeader } from './backlinkChecker/BacklinkHeader';
import { BacklinkGapSection } from './backlinkChecker/BacklinkGapSection';
import { BacklinkMetricsGrid } from './backlinkChecker/BacklinkMetricsGrid';
import { BacklinkEquityAndAnchors } from './backlinkChecker/BacklinkEquityAndAnchors';
import { BacklinkInboundTable } from './backlinkChecker/BacklinkInboundTable';
import { BacklinkOutreachSection } from './backlinkChecker/BacklinkOutreachSection';
import { OffPageSourcesWorkspace } from './backlinkChecker/OffPageSourcesWorkspace';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { prePublishContext } from '@/services/prePublish/context';
import { useOutreachIgos } from './backlinkChecker/useOutreachIgos';

export const BacklinkChecker: React.FC = () => {
  const session = useBacklinkSession();
  const project = useProjectStore((store) => store.projects.find((entry) => entry.id === store.activeProjectId));
  const runs = useToolsStore((store) => store.crawlRuns);
  const context = useMemo(() => prePublishContext(project?.id ?? null, runs), [project?.id, runs]);
  const outreachIgos = useOutreachIgos(session.backlinkGapReport, project?.rootUrl ?? '', context.pages, project?.id);
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
      <DataForSeoCostMeter />
      <BacklinkGapSection session={session} />
      <BacklinkOutreachSection report={session.backlinkGapReport} site={project?.rootUrl} igosReport={outreachIgos.report} sourceCandidates={outreachIgos.sourceCandidates} />

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
          <OffPageSourcesWorkspace profile={backlinkProfile} />
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
