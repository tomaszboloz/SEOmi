import { useMemo } from 'react';
import { OutreachTargetsPanel } from '@/components/Domain/OutreachTargetsPanel';
import { downloadBlob } from '@/services/download';
import { outreachTargets, targetsToCsv, type OutreachTarget } from '@/services/outreachCopilot';
import type { BacklinkGapReport } from '@/types';

/** Outreach targets derived from the real backlink-gap report; empty without a report. */
export const BacklinkOutreachSection = ({ report }: { report: BacklinkGapReport | null }) => {
  const targets = useMemo(() => (report ? outreachTargets(report.opportunities, report.competitors.length) : []), [report]);
  const onExport = (rows: OutreachTarget[]) =>
    downloadBlob('seomi-outreach-targets.csv', new Blob([targetsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  return <OutreachTargetsPanel targets={targets} onExport={onExport} />;
};
