import type { TemplateCluster } from './cluster';

export type TemplateVerdict = 'ok' | 'thin-template' | 'template-bloat';
export type SegmentAction = 'none' | 'limit' | 'noindex';

export interface TemplateEvent {
  pattern: string;
  pageCount: number;
  /** Mean share of a page's words that the template does not already provide (0 to 1). */
  informationGain: number;
  verdict: TemplateVerdict;
  action: SegmentAction;
  urls: string[];
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
}

const DEFAULTS = { minPages: 10, sharedShare: 0.8, thinBelow: 0.3, noindexBelow: 0.15 };

const wordSet = (text: string): Set<string> => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

/** Template Information Gain: how much of each page is not boilerplate shared by the cluster. */
export const templateInformationGain = (cluster: TemplateCluster, sharedShare = DEFAULTS.sharedShare): number => {
  const sets = cluster.pages.map((page) => wordSet(page.text));
  const counts = new Map<string, number>();
  sets.forEach((set) => set.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1)));
  const gains = sets
    .filter((set) => set.size > 0)
    .map((set) => [...set].filter((word) => (counts.get(word) ?? 0) / sets.length < sharedShare).length / set.size);
  return gains.length === 0 ? 0 : gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
};

/** One event per weak template instead of one warning per URL. Healthy and small clusters yield nothing. */
export const governTemplates = (clusters: TemplateCluster[], options: GovernorOptions = {}): TemplateEvent[] => {
  const { minPages, sharedShare, thinBelow, noindexBelow } = { ...DEFAULTS, ...options };
  return clusters
    .filter((cluster) => cluster.pages.length >= minPages)
    .map((cluster): TemplateEvent => {
      const informationGain = templateInformationGain(cluster, sharedShare);
      const thin = informationGain < thinBelow;
      const action: SegmentAction = informationGain < noindexBelow ? 'noindex' : thin ? 'limit' : 'none';
      return {
        pattern: cluster.pattern,
        pageCount: cluster.pages.length,
        informationGain,
        verdict: !thin ? 'ok' : cluster.pages.length >= minPages * 5 ? 'template-bloat' : 'thin-template',
        action,
        urls: cluster.pages.map((page) => page.url),
      };
    })
    .filter((event) => event.verdict !== 'ok');
};
