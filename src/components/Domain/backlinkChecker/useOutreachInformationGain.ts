import { useEffect, useState } from 'react';
import type { BacklinkGapReport, CrawledPageSummary } from '@/types';
import { produceInformationGain } from '@/services/outreachCopilot/igosProducer';
import type { InformationGainInput } from '@/services/outreachCopilot';

interface Input { projectId: string | null; site: string; report: BacklinkGapReport | null; pages: CrawledPageSummary[]; enabled?: boolean }

/** Project-scoped production caller; missing crawl/provider data stays unavailable. */
export const useOutreachInformationGain = ({ projectId, site, report, pages, enabled = true }: Input): InformationGainInput | null => {
  const [result, setResult] = useState<InformationGainInput | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    if (!enabled || !projectId || !site || !report || pages.length === 0) return () => controller.abort();
    void produceInformationGain({ projectId, site, competitors: report.competitors, pages }, controller.signal)
      .then((next) => { if (!controller.signal.aborted) setResult(next); })
      .catch(() => { if (!controller.signal.aborted) setResult(null); });
    return () => controller.abort();
  }, [enabled, pages, projectId, report, site]);
  return result;
};
