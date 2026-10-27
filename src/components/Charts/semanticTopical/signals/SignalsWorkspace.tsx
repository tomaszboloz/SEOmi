import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SprsPanel } from '@/components/Charts/SprsPanel';
import { HreflangParityPanel } from '@/components/Charts/HreflangParityPanel';
import { DecayRadarPanel } from '@/components/Charts/DecayRadarPanel';
import { TemplateGovernorPanel } from '@/components/Results/TemplateGovernorPanel';
import { CausalImpactPanel } from '@/components/Results/CausalImpactPanel';
import { ExperimentsPanel } from '@/components/Charts/ExperimentsPanel';
import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { StaleSnapshotBanner } from '@/services/snapshots/StaleBanner';
import { SprsWhatIf } from '@/components/Charts/SprsWhatIf';
import { computeSprs } from '@/services/semanticGraph/sprs';
import { buildSprsInput } from './sprsAdapter';
import { useGraphSnapshot } from './useGraphSnapshot';
import { buildParityReport } from './parityAdapter';
import { buildTemplateEvents, subtopicsFromAuthorityReport, subtopicsFromGraph } from './templateAdapter';
import { useDecayHistory } from './useDecayHistory';
import { useCausalImpact } from './useCausalImpact';

export interface SignalsWorkspaceProps {
  projectId?: string | null;
  pages: CrawledPageSummary[];
  graph: SemanticMap;
  subtopicsByUrl?: Record<string, string>;
  authorityReport?: { coverage?: Array<{ subtopicId: string; urls: string[] }> } | null;
}

export const SignalsWorkspace = ({
  projectId = null,
  pages,
  graph,
  subtopicsByUrl: propSubtopics,
  authorityReport = null,
}: SignalsWorkspaceProps) => {
  const { t } = useTranslation();
  const decay = useDecayHistory(projectId);
  const causalImpact = useCausalImpact(projectId, pages[0]?.url);
  const { snapshot, stale, refresh } = useGraphSnapshot(graph);
  const sprsInput = useMemo(() => buildSprsInput(snapshot), [snapshot]);
  const sprs = useMemo(() => computeSprs(sprsInput.nodes, sprsInput.edges), [sprsInput]);
  const parity = useMemo(() => buildParityReport(pages, graph), [pages, graph]);
  const authoritySubtopics = useMemo(
    () => subtopicsFromAuthorityReport(authorityReport),
    [authorityReport],
  );
  const subtopicsByUrl = useMemo(
    () => ({ ...authoritySubtopics, ...subtopicsFromGraph(graph), ...propSubtopics }),
    [authoritySubtopics, graph, propSubtopics],
  );
  const templates = useMemo(
    () => buildTemplateEvents(pages, { subtopicsByUrl }),
    [pages, subtopicsByUrl],
  );
  return (
    <div className="space-y-4" data-testid="signals-workspace" aria-label={t('semanticWorkspace.tabSignals')}>
      <StaleSnapshotBanner stale={stale} onRefresh={refresh} />
      <SprsPanel report={sprs} />
      <SprsWhatIf nodes={sprsInput.nodes} edges={sprsInput.edges} />
      <HreflangParityPanel report={parity} />
      <TemplateGovernorPanel events={templates} />
      <DecayRadarPanel evaluation={decay.evaluation} snapshotCount={decay.snapshotCount} />
      <CausalImpactPanel result={causalImpact} />
      <ExperimentsPanel projectId={projectId} pages={pages} />
    </div>
  );
};
