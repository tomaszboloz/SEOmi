import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { SemanticPageNode } from '@/services/semanticMap';
import type { CrawlRunRecord, CrawledPageSummary } from '@/types';
import { Network, ListTree, BarChart3, ClipboardCheck } from 'lucide-react';

export interface CrawlArchitectureGraphProps { pages: CrawledPageSummary[]; startUrl: string; crawlMode?: string; runId?: string; sitemapUrls?: string[]; runs?: CrawlRunRecord[]; currentRunId?: string; }
export interface LayoutPoint { x: number; y: number; }
export interface SemanticMapPreferences {
  query: string;
  clusterFilter: string;
  orphansOnly: boolean;
  linkMode: 'content' | 'all';
  selectedUrl: string | null;
  activeView: MapView;
  /** Restricts the graph to the pages of one diagnosis area or topic. */
  diagnosisFilter: DiagnosisFilter | null;
  positions: Record<string, LayoutPoint>;
  transform: { x: number; y: number; k: number };
}

export interface DiagnosisFilter { kind: 'area' | 'topic'; id: string; }

export type MapView = 'diagnosis' | 'graph' | 'directory' | 'plan';
export const MAP_VIEWS: readonly MapView[] = ['diagnosis', 'graph', 'directory', 'plan'];

export const buildMapViewTabs = (translate: (key: string) => string): Array<{ id: MapView; label: string; description: string; icon: typeof Network }> => [
  { id: 'diagnosis', label: translate('mapUi.tabs.diagnosis'), description: translate('mapUi.tabs.diagnosisDescription'), icon: ClipboardCheck },
  { id: 'graph', label: translate('mapUi.tabs.graph'), description: translate('mapUi.tabs.graphDescription'), icon: Network },
  { id: 'directory', label: translate('mapUi.tabs.directory'), description: translate('mapUi.tabs.directoryDescription'), icon: ListTree },
  { id: 'plan', label: translate('mapUi.tabs.plan'), description: translate('mapUi.tabs.planDescription'), icon: BarChart3 },
];

export interface SimNode extends SimulationNodeDatum {
  id: string;
  semanticNode: SemanticPageNode;
  color: string;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  anchors: string[];
  links: number;
  kind: 'content-link' | 'topic-similarity';
  sharedTerms: string[];
  weightedJaccard: number;
}

export const WIDTH = 1120;
export const HEIGHT = 620;
export const CLUSTER_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#fb7185', '#2dd4bf', '#a3e635', '#f97316', '#818cf8', '#e879f9'];
