import { useMemo } from 'react';
import type { BacklinkProfileData } from '@/types';
import { computeTbva, type TbvaReport } from '@/services/offPage/tbva';
import { findCoCitations, type CoCitationReport } from '@/services/offPage/cocitation';

export interface OffPageReports { tbva: TbvaReport; coCitation: CoCitationReport }

/**
 * Real backlink rows only. No source text or topic embedding is fetched here, so TBVA reports its
 * limitation and co-citation reports "no source text" instead of inventing a score.
 */
export const buildOffPageReports = (profile: BacklinkProfileData | null): OffPageReports => ({
  tbva: computeTbva(
    (profile?.backlinks ?? []).map((b) => ({ sourceUrl: b.source_url, authority: b.domain_rank, follow: b.is_dofollow, vector: null })),
    { scale: 100, topic: null },
  ),
  coCitation: findCoCitations([], [], ''),
});

export const useOffPageReports = (profile: BacklinkProfileData | null): OffPageReports =>
  useMemo(() => buildOffPageReports(profile), [profile]);
