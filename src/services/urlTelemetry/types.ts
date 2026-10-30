/** Shared URL telemetry snapshot (#91). Unknown is never zero: every measurement carries a state. */
export type MeasureState = 'measured' | 'missing-permission' | 'partial-history' | 'stale' | 'sampled' | 'unavailable';

export interface Measure<T> { state: MeasureState; value: T | null; note?: string }

export interface GscValue { clicks: number; impressions: number; position: number | null; observedQueryCount: number | null; queryCountTruncated: boolean }
export interface Ga4Value { sessions: number; engagedSessions: number; keyEvents: number }
export interface BacklinkValue { referringDomains: number }

export interface UrlTelemetry {
  url: string;
  gsc: Measure<GscValue>;
  ga4: Measure<Ga4Value>;
  backlinks: Measure<BacklinkValue>;
  /** Revenue and currency need a conversion/attribution decision (#91 D01); never defaulted. */
  revenue: Measure<{ amount: number; currency: string }>;
}

export interface SourceProvenance {
  state: MeasureState;
  property?: string;
  period?: { start: string; end: string; days: number };
  searchType?: string;
  rowLimit?: number;
  truncated?: boolean;
  provider?: string;
  retrievedAt?: string;
  coveragePct?: number | null;
  /** Revenue only: ISO 4217 currency stated by the user, and the attribution model. */
  currency?: string;
  attribution?: string;
}

export interface UrlTelemetrySnapshot {
  id: string;
  projectId: string;
  origin: string;
  createdAt: string;
  expiresAt: string;
  sources: { gsc: SourceProvenance; ga4: SourceProvenance; backlinks: SourceProvenance; revenue?: SourceProvenance };
  urls: readonly UrlTelemetry[];
}

export type SourceFailure = 'permission' | 'unavailable';
