import { useMemo } from 'react';
import { OutreachTargetsPanel } from '@/components/Domain/OutreachTargetsPanel';
import { downloadBlob } from '@/services/download';
import { igosSourceStatus, outreachTargets, resolveIgosSource, targetsToCsv, type IgosSourceStatus, type IgosSourceCandidate, type OutreachTarget, type UniqueSource } from '@/services/outreachCopilot';
import type { IgosReport } from '@/services/igos/report';
import type { BacklinkGapReport } from '@/types';

/** Outreach targets derived from the real backlink-gap report; empty without a report. */
export interface BacklinkOutreachSectionProps {
  report: BacklinkGapReport | null;
  site?: string;
  igosReport?: Pick<IgosReport, 'status' | 'igos'> | null;
  sourceCandidates?: IgosSourceCandidate[];
}

export const BacklinkOutreachSection = ({ report, site, igosReport = null, sourceCandidates = [] }: BacklinkOutreachSectionProps) => {
  const topCompetitors = report?.competitors.slice(0, 3) ?? [];
  const targets = useMemo(() => (report ? outreachTargets(report.opportunities, topCompetitors.length, { topCompetitors }) : []), [report, topCompetitors]);
  const sourceStatus: IgosSourceStatus = igosSourceStatus(igosReport);
  const sources = sourceCandidates.map((candidate) => resolveIgosSource(igosReport, candidate)).filter((candidate): candidate is UniqueSource => candidate !== null);
  const onExport = (rows: OutreachTarget[]) =>
    downloadBlob('seomi-outreach-targets.csv', new Blob([targetsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  return <OutreachTargetsPanel targets={targets} onExport={onExport} site={site ?? report?.target ?? ''} sources={sources} sourceStatus={sourceStatus} />;
};
