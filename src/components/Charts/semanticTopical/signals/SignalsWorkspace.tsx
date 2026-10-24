import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SprsPanel } from '@/components/Charts/SprsPanel';
import { HreflangParityPanel } from '@/components/Charts/HreflangParityPanel';
import { DecayRadarPanel } from '@/components/Charts/DecayRadarPanel';
import { TemplateGovernorPanel } from '@/components/Results/TemplateGovernorPanel';
import { CausalImpactPanel } from '@/components/Results/CausalImpactPanel';
import { evaluateDecay } from '@/services/semanticDecay/alert';
import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { StaleSnapshotBanner } from '@/services/snapshots/StaleBanner';
import { SprsWhatIf } from '@/components/Charts/SprsWhatIf';
import { computeSprs } from '@/services/semanticGraph/sprs';
import { buildSprsInput } from './sprsAdapter';
import { useGraphSnapshot } from './useGraphSnapshot';
import { buildParityReport } from './parityAdapter';
import { buildTemplateEvents } from './templateAdapter';

/**
 * Crawl-derived signals. SERP-history decay and causal impact have no stored producer yet
 * (no snapshots or GSC time series are persisted), so they render their honest empty states.
 */
export const SignalsWorkspace = ({ pages, graph }: { pages: CrawledPageSummary[]; graph: SemanticMap }) => {
  const { t } = useTranslation();
  const { snapshot, stale, refresh } = useGraphSnapshot(graph);
  const sprsInput = useMemo(() => buildSprsInput(snapshot), [snapshot]);
  const sprs = useMemo(() => computeSprs(sprsInput.nodes, sprsInput.edges), [sprsInput]);
  const parity = useMemo(() => buildParityReport(pages, graph), [pages, graph]);
  const templates = useMemo(() => buildTemplateEvents(pages), [pages]);
  const decay = useMemo(() => evaluateDecay([], null, new Date().toISOString()), []);
  return <div className="space-y-4" data-testid="signals-workspace" aria-label={t('semanticWorkspace.tabSignals')}>
    <StaleSnapshotBanner stale={stale} onRefresh={refresh} />
    <SprsPanel report={sprs} />
    <SprsWhatIf nodes={sprsInput.nodes} edges={sprsInput.edges} />
    <HreflangParityPanel report={parity} />
    <TemplateGovernorPanel events={templates} />
    <DecayRadarPanel evaluation={decay} />
    <CausalImpactPanel result={null} />
  </div>;
};
