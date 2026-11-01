import { useMemo } from 'react';
import type { BacklinkProfileData } from '@/types';
import { computeTbva, type TbvaReport } from '@/services/offPage/tbva';
import { findCoCitations, type CoCitationReport } from '@/services/offPage/cocitation';
import type { SourceAnalysis } from '@/services/offPage/sources';
import { sourceParagraphs } from '@/services/offPage/sourceParagraphs';

export interface OffPageReports { tbva: TbvaReport; coCitation: CoCitationReport }

export const buildOffPageReports = (profile: BacklinkProfileData | null, analysis: SourceAnalysis | null = null): OffPageReports => ({
  tbva: computeTbva(
    analysis ? analysis.sources.map((source) => ({ ...source, follow: true }))
      : (profile?.backlinks ?? []).map((b) => ({ sourceUrl: b.source_url, authority: b.domain_rank, follow: b.is_dofollow, vector: null })),
    { scale: 100, topic: analysis?.topic ?? null },
  ),
  coCitation: findCoCitations(sourceParagraphs(analysis?.sources ?? []), analysis?.aliases ?? [], analysis?.coreEntity ?? '', analysis?.senses),
});

export const useOffPageReports = (profile: BacklinkProfileData | null, analysis: SourceAnalysis | null = null): OffPageReports =>
  useMemo(() => buildOffPageReports(profile, analysis), [profile, analysis]);
