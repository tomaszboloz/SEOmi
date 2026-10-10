import type { SiteCrawlResult } from '@/types';
import type { Ga4DateRange, Ga4Discovery, Ga4JoinResult, Ga4Property, Ga4Report } from '@/types/ga4';
import type { SearchConsoleSession } from '../useSearchConsoleSession';

export interface Ga4PanelProps {
  session: SearchConsoleSession;
  projectRootUrl?: string;
  crawlResult?: SiteCrawlResult | null;
  analyticsClientSecret?: string;
}

export interface Ga4SessionState {
  analyticsConnected: boolean;
  discovery: Ga4Discovery | null;
  matchedProperties: Ga4Property[];
  selectedProperty: Ga4Property | null;
  report: Ga4Report | null;
  joined: Ga4JoinResult | null;
  loading: 'idle' | 'connecting' | 'listing' | 'reporting';
  error: string | null;
  dateRange: Ga4DateRange;
  connectAnalytics: (clientSecret?: string) => Promise<void>;
  refreshProperties: () => Promise<void>;
  loadReport: () => Promise<void>;
}
