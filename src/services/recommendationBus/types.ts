export type QuarantineReason = 'remove' | 'redirect';

export interface QuarantineEntry {
  url: string;
  reason: QuarantineReason;
  quarantined: true;
  /** Redirect destination (canonical URL) when reason is `redirect`. */
  target?: string;
  source: 'site-focus' | 'topical-authority';
}

export type BusConflictKind = 'protected-by-evidence' | 'canonical-removed';

export interface BusConflict {
  kind: BusConflictKind;
  url: string;
}

export interface CannibalInput {
  urls: string[];
  canonical: string;
}

export interface BusInput {
  /** URLs Site Focus recommends removing (remove-offtopic). */
  removeUrls: string[];
  /** URLs with GSC clicks or backlinks (#81): never quarantined for removal. */
  protectedUrls?: string[];
  /** Cannibalisation groups: every non-canonical URL is redirected to canonical. */
  cannibal?: CannibalInput[];
}

export interface BusResult {
  quarantine: QuarantineEntry[];
  conflicts: BusConflict[];
}
