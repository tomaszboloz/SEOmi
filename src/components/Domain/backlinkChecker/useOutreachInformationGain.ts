import { useEffect, useMemo, useState } from 'react';
import type { BacklinkGapReport, CrawledPageSummary } from '@/types';
import { produceInformationGain } from '@/services/outreachCopilot/igosProducer';
import { informationGainRequestKey } from '@/services/outreachCopilot/requestKey';
import type { InformationGainInput } from '@/services/outreachCopilot';

interface Input { projectId: string | null; site: string; report: BacklinkGapReport | null; pages: CrawledPageSummary[]; enabled?: boolean }
interface Keyed { key: string; value: InformationGainInput | null }

/**
 * Project-scoped production caller; missing crawl/provider data stays unavailable.
 * A request is identified by an unambiguous structured key (#143): a new array
 * reference with identical content does not refetch, while any change in
 * entities or paragraph boundaries starts a new request and hides the old result.
 */
export const useOutreachInformationGain = ({ projectId, site, report, pages, enabled = true }: Input): InformationGainInput | null => {
  const request = useMemo(() => {
    if (!enabled || !projectId || !site || !report || pages.length === 0) return null;
    const input = { projectId, site, competitors: report.competitors, pages };
    return { key: informationGainRequestKey(input), input };
  }, [enabled, pages, projectId, report, site]);
  const key = request?.key ?? null;
  const [result, setResult] = useState<Keyed | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!request) return () => controller.abort();
    const settle = (value: InformationGainInput | null) => { if (!controller.signal.aborted) setResult({ key: request.key, value }); };
    void produceInformationGain(request.input, controller.signal).then(settle, () => settle(null));
    return () => controller.abort();
    // The structured key is the request identity; `request` only changes meaningfully with it.
  }, [key]);
  return result && result.key === key ? result.value : null;
};
