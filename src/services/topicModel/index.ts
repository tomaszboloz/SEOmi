import type { SiteFocusReport } from '@/services/siteFocus/types';

/**
 * One read-only topic model (#106): the Site Focus Core Topic and term clusters, exposed once for every
 * consumer (incremental scoring, Topical Authority) instead of each re-reading `report.model` its own way.
 */
export interface TopicModel {
  language: string;
  coreClusterId: string;
  coreLabel: string;
  /** Term keys of the Core Topic cluster. */
  coreKeys: ReadonlySet<string>;
  kCore: readonly string[];
  coreWeights: ReadonlyMap<string, number>;
  termCluster: ReadonlyMap<string, string>;
  clusterLabels: Readonly<Record<string, string>>;
  clusterOf: (termKey: string) => string | undefined;
}

export const topicModelOf = (report: Pick<SiteFocusReport, 'model' | 'coreTopic'>): TopicModel => {
  const { model } = report;
  const termCluster = new Map(Object.entries(model.termCluster));
  return {
    language: model.language,
    coreClusterId: model.coreClusterId,
    coreLabel: report.coreTopic.label,
    coreKeys: new Set([...termCluster].filter(([, id]) => id === model.coreClusterId).map(([key]) => key)),
    kCore: model.kCore,
    coreWeights: new Map(Object.entries(model.coreWeights)),
    termCluster,
    clusterLabels: model.clusterLabels,
    clusterOf: (termKey) => termCluster.get(termKey),
  };
};
