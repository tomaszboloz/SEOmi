import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { RemovalGuard } from './guard';
import type { BusInput } from './types';

/** Site Focus Content Guard threshold: pages below this TRS are removal candidates. */
export const REMOVE_TRS_BELOW = 40;

/** SFS content pages with TRS < 40 (not technical, not skipped). Candidates only: the guard decides. */
export const removalCandidates = (sfs?: SiteFocusReport): PageFocus[] =>
  (sfs?.pages ?? []).filter((page) => !page.skipped && page.type !== 'technical' && page.trs < REMOVE_TRS_BELOW);

/**
 * Builds the bus input from real module output only:
 * SFS removal candidates, the telemetry guard over them and TAS cannibalization groups.
 */
export const busInputFromReports = (sfs?: SiteFocusReport, tas?: TopicalAuthorityReport, guard: Partial<RemovalGuard> = {}): BusInput => ({
  removeUrls: removalCandidates(sfs).map((page) => page.url),
  protectedUrls: guard.protectedUrls ?? [],
  needsDataUrls: guard.needsDataUrls ?? [],
  cannibal: (tas?.cannibalization ?? []).map((group) => ({ urls: group.urls, canonical: group.canonical })),
});
