import type { AioReport } from '@/services/aioReadiness';
import type { TrustReport } from '@/services/eeatTrust';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { HssModuleInput } from './types';

/** Module reports of one crawl run. Absent report = the module did not run for this view. */
export interface HssSources {
  runId: string;
  sfs?: SiteFocusReport | null;
  tas?: TopicalAuthorityReport | null;
  trust?: TrustReport | null;
  aio?: AioReport | null;
}

/**
 * Decision (default chosen by agent, GEM-72-06 / GEM-72-D02): IGOS, SPRS and SIJA are per-page / per-phrase
 * engines without an agreed site-level scalar. Until #83 defines that aggregation they are never averaged
 * or invented here: they enter HSS as unavailable with this reason, and HSS renormalises without them.
 */
export const DOMAIN_AGGREGATION_UNDEFINED = 'domain-aggregation-undefined';

const missing = (module: HssModuleInput['module'], reason: string): HssModuleInput => ({ module, value: null, reason });

const aioInput = (aio: AioReport, runId: string): HssModuleInput => {
  if (aio.availability === 'unavailable' || aio.availability === 'error' || aio.availability === 'cancelled') return missing('aior', `aio-${aio.availability}`);
  if (!aio.scoredCount) return missing('aior', 'aio-unavailable');
  const sourceRun = aio.sourceSnapshot?.crawlRunId;
  if (aio.availability === 'stale') return { module: 'aior', value: aio.score, runId: `${sourceRun ?? 'stale'}:stale`, reason: 'aio-stale' };
  return { module: 'aior', value: aio.score, runId: sourceRun ?? runId, ...(aio.availability === 'partial' ? { reason: 'aio-partial' } : {}) };
};

/** Reads only the scalar each engine already reports (GEM-72-01): no engine is recomputed here. */
export const hssInputsFromReports = ({ runId, sfs, tas, trust, aio }: HssSources): HssModuleInput[] => [
  !sfs ? missing('sfs', 'not-run') : sfs.unavailable ? missing('sfs', 'sfs-no-scored-pages') : { module: 'sfs', value: sfs.score, runId },
  !tas ? missing('tas', 'not-run') : tas.tas === null ? missing('tas', 'tas-no-reference-map') : { module: 'tas', value: tas.tas, runId },
  missing('igos', DOMAIN_AGGREGATION_UNDEFINED),
  missing('sprs', DOMAIN_AGGREGATION_UNDEFINED),
  !trust ? missing('eetv', 'not-run') : trust.score === null || trust.availability === 'unavailable' ? missing('eetv', 'eetv-no-signals') : { module: 'eetv', value: trust.score, runId },
  missing('sija', DOMAIN_AGGREGATION_UNDEFINED),
  !aio ? missing('aior', 'not-run') : aioInput(aio, runId),
];
