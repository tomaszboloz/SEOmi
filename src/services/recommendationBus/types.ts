export type QuarantineReason = 'remove' | 'redirect';

export interface QuarantineEntry {
  url: string;
  reason: QuarantineReason;
  quarantined: true;
  /** Redirect destination (canonical URL) when reason is `redirect`. */
  target?: string;
  source: 'site-focus' | 'topical-authority';
}

export type BusConflictKind = 'protected-by-evidence' | 'needs-data' | 'canonical-removed';

export interface BusConflict {
  kind: BusConflictKind;
  url: string;
}

export interface CannibalInput {
  urls: string[];
  canonical: string;
}

export interface BusInput {
  /** Site Focus removal candidates (TRS below the Content Guard threshold); the guard lists decide. */
  removeUrls: string[];
  /** URLs shielded by traffic, conversions, revenue or links, or kept as a semantic bridge (#81): never quarantined for removal. */
  protectedUrls?: string[];
  /** URLs whose telemetry is missing, partial or stale (#81): checked first, never quarantined for removal. */
  needsDataUrls?: string[];
  /** Cannibalisation groups: every non-canonical URL is redirected to canonical. */
  cannibal?: CannibalInput[];
}

export interface BusResult {
  quarantine: QuarantineEntry[];
  conflicts: BusConflict[];
}
