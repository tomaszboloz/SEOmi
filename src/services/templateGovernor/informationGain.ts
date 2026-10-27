import { deduplicateTasPages, type TemplateCluster, type TemplatePage } from './cluster';

export type TemplateVerdict = 'ok' | 'thin-template' | 'template-bloat' | 'unverified-structure' | 'bounded-sample';
export type SegmentAction = 'none' | 'limit' | 'noindex';

export interface TemplateProposal {
  action: Exclude<SegmentAction, 'none'>;
  scope: 'template-segment';
  readOnly: true;
  requiresApproval: true;
}

export interface TemplateEvent {
  pattern: string;
  pageCount: number;
  /** Mean share of a page's words that the template does not already provide (0 to 1), or null when unmeasured. */
  informationGain: number | null;
  /** Share of injected URL/render variables unique to a page in the cluster. */
  uniqueVariableShare: number | null;
  domSignatureProvenance: 'crawler' | 'unavailable';
  injectedVariablesProvenance: 'crawler' | 'unavailable';
  verdict: TemplateVerdict;
  action: SegmentAction;
  /** A proposal only; applying a noindex/limit decision requires explicit approval elsewhere. */
  recommendation: TemplateProposal | null;
  urls: string[];
  /** TAS projection: representative URLs retaining 1 page per subtopic node. */
  tasRepresentativeUrls?: string[];
  /** Count of distinct TAS subtopic nodes represented in this cluster. */
  tasSubtopicCount?: number;
  /** Explicit sampling status when only a small fragment of total content was sampled. */
  isSampledOnly?: boolean;
  sampleCoverageRatio?: number | null;
  measurementBoundary?: 'full' | 'sampled-prefix' | 'unavailable';
}

export interface GovernorOptions {
  /** Smallest cluster treated as programmatic. */
  minPages?: number;
  /** Words present on at least this share of pages count as template text. */
  sharedShare?: number;
  /** Below this gain the template is thin. */
  thinBelow?: number;
  /** Below this gain the whole segment should be noindexed. */
  noindexBelow?: number;
  /** Below this variable uniqueness, a large generated segment is also considered thin. */
  uniqueVariableBelow?: number;
}

const DEFAULTS = { minPages: 10, sharedShare: 0.8, thinBelow: 0.3, noindexBelow: 0.15, uniqueVariableBelow: 0.3 };

const wordSet = (text: string): Set<string> => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

const injected = (page: TemplatePage): Set<string> | null => {
  if (page.injectedVariables === undefined) return null;
  return new Set(page.injectedVariables.flatMap((value) => [...wordSet(value)]));
};

const uniqueShare = (cluster: TemplateCluster, sharedShare: number): number | null => {
  const values = cluster.pages.map(injected);
  if (values.some((set) => set === null)) return null;
  const sets = values as Set<string>[];
  const counts = new Map<string, number>();
  sets.forEach((set) => set.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1)));
  const shares = sets.filter((set) => set.size).map((set) => [...set].filter((value) => (counts.get(value) as number) / sets.length < sharedShare).length / set.size);
  return shares.length ? shares.reduce((sum, value) => sum + value, 0) / shares.length : 0;
};

export const uniqueInjectedVariableShare = (cluster: TemplateCluster, sharedShare = DEFAULTS.sharedShare): number | null => uniqueShare(cluster, sharedShare);

/** Template Information Gain: how much of each page is not boilerplate shared by the cluster. */
export const templateInformationGain = (cluster: TemplateCluster, sharedShare = DEFAULTS.sharedShare): number => {
  const sets = cluster.pages.map((page) => {
    const values = injected(page);
    return new Set([...wordSet(page.text), ...(values ? [...values] : [])]);
  });
  const counts = new Map<string, number>();
  sets.forEach((set) => set.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1)));
  const gains = sets
    .filter((set) => set.size > 0)
    .map((set) => [...set].filter((word) => (counts.get(word) as number) / sets.length < sharedShare).length / set.size);
  return gains.length === 0 ? 0 : gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
};

/** One event per weak template instead of one warning per URL. Healthy and small clusters yield nothing. */
export const governTemplates = (clusters: TemplateCluster[], options: GovernorOptions = {}): TemplateEvent[] => {
  const { minPages, sharedShare, thinBelow, noindexBelow, uniqueVariableBelow } = { ...DEFAULTS, ...options };
  return clusters
    .filter((cluster) => cluster.pages.length >= minPages)
    .map((cluster): TemplateEvent => {
      const hasUnavailableDom = cluster.pages.some((page) => page.domSignatureProvenance === 'unavailable');
      const ratios = cluster.pages.map((p) => p.sampleCoverageRatio).filter((r): r is number => typeof r === 'number');
      const avgSampleCoverage = ratios.length ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length : null;
      const isSampledOnly = typeof avgSampleCoverage === 'number' && avgSampleCoverage < 0.25;

      const rawGain = templateInformationGain(cluster, sharedShare);
      const uniqueVariableShare = uniqueInjectedVariableShare(cluster, sharedShare);
      const informationGain = isSampledOnly ? null : rawGain;
      const thin = (!isSampledOnly && rawGain < thinBelow) || (uniqueVariableShare !== null && uniqueVariableShare < uniqueVariableBelow) || isSampledOnly;

      const verdict: TemplateVerdict = !thin ? 'ok' : hasUnavailableDom ? 'unverified-structure' : isSampledOnly ? 'bounded-sample' : cluster.pages.length >= minPages * 5 ? 'template-bloat' : 'thin-template';
      const action: SegmentAction = verdict === 'ok' ? 'none' : (hasUnavailableDom || isSampledOnly) ? 'limit' : rawGain < noindexBelow ? 'noindex' : 'limit';

      const tasPages = deduplicateTasPages(cluster.pages);
      const tasSubtopics = new Set(cluster.pages.map((p) => p.subtopicId?.trim()).filter(Boolean));
      return {
        pattern: cluster.pattern,
        pageCount: cluster.pages.length,
        informationGain,
        uniqueVariableShare,
        domSignatureProvenance: cluster.pages.every((page) => page.domSignatureProvenance === 'crawler') ? 'crawler' : 'unavailable',
        injectedVariablesProvenance: cluster.pages.every((page) => page.injectedVariables !== undefined && page.injectedVariablesProvenance !== 'unavailable') ? 'crawler' : 'unavailable',
        verdict,
        action,
        recommendation: action === 'none' ? null : { action, scope: 'template-segment', readOnly: true, requiresApproval: true },
        urls: cluster.pages.map((page) => page.url),
        tasRepresentativeUrls: tasPages.map((page) => page.url),
        tasSubtopicCount: tasSubtopics.size,
        isSampledOnly,
        sampleCoverageRatio: avgSampleCoverage,
        measurementBoundary: isSampledOnly ? 'sampled-prefix' : 'full',
      };
    })
    .filter((event) => event.verdict !== 'ok');
};
