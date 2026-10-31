import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SprsPanel } from '@/components/Charts/SprsPanel';
import { HreflangParityPanel } from '@/components/Charts/HreflangParityPanel';
import { EntityParityPanel } from '@/components/Charts/EntityParityPanel';
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
import { buildParityReport, languageTopics } from './parityAdapter';
import { useEntityLinks } from './useEntityLinks';
import { buildTemplateEvents, subtopicsFromAuthorityReport, subtopicsFromGraph } from './templateAdapter';
import { useDecayHistory } from './useDecayHistory';
import { useParityExceptions } from './useParityExceptions';
import { useCausalImpact } from './useCausalImpact';
import { useToolsStore } from '@/stores/toolsStore';

export interface SignalsWorkspaceProps {
  projectId?: string | null;
  pages: CrawledPageSummary[];
  graph: SemanticMap;
  subtopicsByUrl?: Record<string, string>;
  authorityReport?: { coverage?: Array<{ subtopicId: string; urls: string[] }> } | null;
}

export const SignalsWorkspace = ({ projectId = null, pages, graph, subtopicsByUrl: providedSubtopics, authorityReport = null }: SignalsWorkspaceProps) => {
  const { t } = useTranslation();
  const gscProperty = useToolsStore((state) => state.gscProperty);
  const gscFilters = useToolsStore((state) => state.gscFilters);
  const gscHydratedProjectId = useToolsStore((state) => state.gscHydratedProjectId);
  const decay = useDecayHistory(projectId);
  const causalImpact = useCausalImpact(projectId, gscProperty || undefined, gscFilters, gscHydratedProjectId === projectId, true);
  const { snapshot, stale, refresh } = useGraphSnapshot(graph);
  const sprsInput = useMemo(() => buildSprsInput(snapshot), [snapshot]);
  const sprs = useMemo(() => computeSprs(sprsInput.nodes, sprsInput.edges), [sprsInput]);
  const parityExceptions = useParityExceptions(projectId);
  const parity = useMemo(() => buildParityReport(pages, graph, parityExceptions.exceptions), [pages, graph, parityExceptions.exceptions]);
  const topics = useMemo(() => languageTopics(pages, graph), [pages, graph]);
  const entities = useEntityLinks(projectId, topics);
  const authoritySubtopics = useMemo(() => subtopicsFromAuthorityReport(authorityReport), [authorityReport]);
  const subtopicsByUrl = useMemo(() => ({ ...authoritySubtopics, ...subtopicsFromGraph(graph), ...providedSubtopics }), [authoritySubtopics, graph, providedSubtopics]);
  const templates = useMemo(() => buildTemplateEvents(pages, { subtopicsByUrl }), [pages, subtopicsByUrl]);
  return <div className="space-y-4" data-testid="signals-workspace" aria-label={t('semanticWorkspace.tabSignals')}>
    <StaleSnapshotBanner stale={stale} onRefresh={refresh} />
    <SprsPanel report={sprs} />
    <SprsWhatIf nodes={sprsInput.nodes} edges={sprsInput.edges} />
    <HreflangParityPanel report={parity} exceptions={parityExceptions.handlers} />
    {topics.length > 0 && new Set(topics.map((topic) => topic.language)).size > 1 && <EntityParityPanel links={entities.links} gaps={entities.gaps} pending={entities.pending} running={entities.running} onMatch={() => void entities.match()} onCorrect={projectId ? entities.correct : undefined} />}
    <TemplateGovernorPanel events={templates} />
    <DecayRadarPanel evaluation={decay.evaluation} snapshotCount={decay.snapshotCount} />
    <CausalImpactPanel result={causalImpact} />
    <ExperimentsPanel projectId={projectId} pages={pages} />
  </div>;
};
