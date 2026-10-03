import {
  Activity,
  Bot,
  Braces,
  CircleAlert,
  FileDown,
  FileText,
  FileWarning,
  Image,
  Languages,
  Link2,
  Map,
  Radar,
  Rows3,
  ScanSearch,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import type { CrawlRunRecord, SiteCrawlResult } from '@/types';

export type CrawlTab =
  | 'overview'
  | 'urls'
  | 'crawlerReadiness'
  | 'issues'
  | 'content'
  | 'metadata'
  | 'customSearch'
  | 'links'
  | 'media'
  | 'frames'
  | 'social'
  | 'directives'
  | 'international'
  | 'structured'
  | 'validation'
  | 'performance'
  | 'visualisations'
  | 'exports';

export type CrawlTabGroup = 'core' | 'content' | 'technical' | 'export';

export interface CrawlResultsTabsProps {
  result: SiteCrawlResult;
  runs: CrawlRunRecord[];
  selectedRun?: CrawlRunRecord;
  onSelectRun: (id: string) => void;
  onDeleteRun?: (id: string) => Promise<void>;
  mapNavigationRequest?: number;
}

export const tabs: Array<{ id: CrawlTab; labelKey: string; icon: typeof Rows3 }> = [
  { id: 'overview', labelKey: 'tabs.overview', icon: Radar },
  { id: 'visualisations', labelKey: 'tabs.visualisations', icon: Map },
  { id: 'crawlerReadiness', labelKey: 'tabs.crawlerReadiness', icon: Bot },
  { id: 'urls', labelKey: 'tabs.urls', icon: Rows3 },
  { id: 'issues', labelKey: 'tabs.issues', icon: CircleAlert },
  { id: 'content', labelKey: 'tabs.content', icon: FileText },
  { id: 'metadata', labelKey: 'tabs.metadata', icon: FileText },
  { id: 'customSearch', labelKey: 'customSearch.tab', icon: ScanSearch },
  { id: 'links', labelKey: 'tabs.links', icon: Link2 },
  { id: 'media', labelKey: 'tabs.media', icon: Image },
  { id: 'frames', labelKey: 'tabs.frames', icon: Image },
  { id: 'social', labelKey: 'tabs.social', icon: Share2 },
  { id: 'directives', labelKey: 'tabs.directives', icon: ShieldCheck },
  { id: 'international', labelKey: 'tabs.international', icon: Languages },
  { id: 'structured', labelKey: 'tabs.structured', icon: Braces },
  { id: 'validation', labelKey: 'tabs.validation', icon: FileWarning },
  { id: 'performance', labelKey: 'tabs.performance', icon: Activity },
  { id: 'exports', labelKey: 'tabs.exports', icon: FileDown },
];

export const tabGroups: Array<{
  id: CrawlTabGroup;
  labelKey: string;
  shortLabelKey: string;
  tabs: CrawlTab[];
}> = [
  {
    id: 'core',
    labelKey: 'groups.core',
    shortLabelKey: 'groups.coreShort',
    tabs: ['overview', 'visualisations', 'crawlerReadiness', 'urls', 'issues'],
  },
  {
    id: 'content',
    labelKey: 'groups.content',
    shortLabelKey: 'groups.contentShort',
    tabs: [
      'content',
      'metadata',
      'customSearch',
      'links',
      'media',
      'frames',
      'social',
    ],
  },
  {
    id: 'technical',
    labelKey: 'groups.technical',
    shortLabelKey: 'groups.technicalShort',
    tabs: [
      'directives',
      'international',
      'structured',
      'validation',
      'performance',
    ],
  },
  {
    id: 'export',
    labelKey: 'groups.export',
    shortLabelKey: 'groups.exportShort',
    tabs: ['exports'],
  },
];

export const tabGroupForTab = (tabId: CrawlTab): CrawlTabGroup =>
  tabGroups.find((group) => group.tabs.includes(tabId))?.id || 'core';
