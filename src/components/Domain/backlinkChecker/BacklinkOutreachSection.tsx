import { useMemo } from 'react';
import { OutreachTargetsPanel } from '@/components/Domain/OutreachTargetsPanel';
import { downloadBlob } from '@/services/download';
import { informationGainSource, normalizeDomain, outreachTargets, targetsToCsv, type InformationGainInput, type OutreachTarget } from '@/services/outreachCopilot';
import type { BacklinkGapReport } from '@/types';

/** Outreach targets derived from the real backlink-gap report; empty without a report. */
export interface BacklinkOutreachSectionProps {
  report: BacklinkGapReport | null;
  projectId?: string | null;
  informationGain?: InformationGainInput | null;
}

export const BacklinkOutreachSection = ({ report, projectId = null, informationGain = null }: BacklinkOutreachSectionProps) => {
  const topCompetitors = useMemo(() => report?.competitors.slice(0, 3).map(normalizeDomain) ?? [], [report]);
  const targets = useMemo(() => (report ? outreachTargets(report.opportunities, topCompetitors.length, { competitorDomains: topCompetitors }) : []), [report, topCompetitors]);
  const source = useMemo(() => (
    informationGain && informationGain.projectId === projectId ? informationGainSource(informationGain) : null
  ), [informationGain, projectId]);
  const onExport = (rows: OutreachTarget[]) =>
    downloadBlob('seomi-outreach-targets.csv', new Blob([targetsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  return <OutreachTargetsPanel targets={targets} onExport={onExport} site={informationGain?.site ?? ''} source={source} />;
};
