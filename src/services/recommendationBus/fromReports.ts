import type { SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { BusInput } from './types';

/** Site Focus Content Guard threshold: pages below this TRS are removal candidates. */
export const REMOVE_TRS_BELOW = 40;

/**
 * Builds the bus input from real module output only:
 * SFS pages with TRS < 40 (not technical, not skipped) and TAS cannibalization groups.
 */
export const busInputFromReports = (sfs?: SiteFocusReport, tas?: TopicalAuthorityReport, protectedUrls: string[] = []): BusInput => ({
  removeUrls: (sfs?.pages ?? []).filter((page) => !page.skipped && page.type !== 'technical' && page.trs < REMOVE_TRS_BELOW).map((page) => page.url),
  protectedUrls,
  cannibal: (tas?.cannibalization ?? []).map((group) => ({ urls: group.urls, canonical: group.canonical })),
});
