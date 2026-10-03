import { DataForSEOSerpItem } from '@/types';
import i18n from '@/i18n';

export interface KeywordSerpSnapshot {
  keyword: string;
  urls: string[];
}

export interface KeywordClusterPair {
  keywordA: string;
  keywordB: string;
  sharedUrls: string[];
}

export interface KeywordSerpCluster {
  id: string;
  keywords: string[];
  pairOverlaps: KeywordClusterPair[];
}

export interface KeywordClusteringResult {
  clusters: KeywordSerpCluster[];
  unclusteredKeywords: string[];
  snapshots: KeywordSerpSnapshot[];
  minSharedUrls: number;
  analyzedAt: string;
}

const TRACKING_PARAMETERS = /^(utm_[^=]+|gclid|dclid|fbclid|msclkid)$/i;

/** Normalize only URL differences that do not identify a distinct result page. */
export const normalizeSerpUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMETERS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    return `${hostname}${url.port ? `:${url.port}` : ''}${pathname}${url.search}`;
  } catch {
    return null;
  }
};

export const getSerpSnapshot = (keyword: string, rows: DataForSEOSerpItem[]): KeywordSerpSnapshot => ({
  keyword,
  // Keep absolute URLs here; clusterKeywordsBySerpOverlap performs normalization
  // once for comparisons and the persisted result.
  urls: [...new Set(rows.map((row) => row.url.trim()).filter((url) => Boolean(normalizeSerpUrl(url))))],
});

/** Group keywords when at least the configured number of organic result URLs overlap. */
export const clusterKeywordsBySerpOverlap = (
  snapshots: KeywordSerpSnapshot[],
  minSharedUrls: number,
  analyzedAt = new Date().toISOString(),
): KeywordClusteringResult => {
  if (!Number.isInteger(minSharedUrls) || minSharedUrls < 1) {
    throw new Error(i18n.t('runtimeErrors.keywordClustering.minSharedUrls'));
  }

  const uniqueSnapshots = snapshots.filter((snapshot, index) =>
    snapshots.findIndex((candidate) => candidate.keyword.trim().toLocaleLowerCase() === snapshot.keyword.trim().toLocaleLowerCase()) === index,
  );
  const parent = uniqueSnapshots.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const pairOverlaps: KeywordClusterPair[] = [];
  for (let a = 0; a < uniqueSnapshots.length; a += 1) {
    const urlsA = new Set(uniqueSnapshots[a].urls.map(normalizeSerpUrl).filter((url): url is string => Boolean(url)));
    for (let b = a + 1; b < uniqueSnapshots.length; b += 1) {
      const sharedUrls = [...new Set(uniqueSnapshots[b].urls
        .map(normalizeSerpUrl)
        .filter((url): url is string => Boolean(url))
        .filter((url) => urlsA.has(url)))];
      if (sharedUrls.length >= minSharedUrls) {
        pairOverlaps.push({ keywordA: uniqueSnapshots[a].keyword, keywordB: uniqueSnapshots[b].keyword, sharedUrls: [...new Set(sharedUrls)] });
        union(a, b);
      }
    }
  }

  const components = new Map<number, number[]>();
  uniqueSnapshots.forEach((_, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) || []), index]);
  });

  const clusters = [...components.values()]
    .filter((members) => members.length > 1)
    .map((members) => {
      const keywords = members.map((index) => uniqueSnapshots[index].keyword);
      const memberSet = new Set(keywords);
      const links = pairOverlaps.filter((pair) => memberSet.has(pair.keywordA) && memberSet.has(pair.keywordB));
      return {
        id: keywords.map((keyword) => keyword.toLocaleLowerCase()).join('|'),
        keywords,
        pairOverlaps: links,
      };
    });

  const clustered = new Set(clusters.flatMap((cluster) => cluster.keywords));
  return {
    clusters,
    unclusteredKeywords: uniqueSnapshots.map((snapshot) => snapshot.keyword).filter((keyword) => !clustered.has(keyword)),
    snapshots: uniqueSnapshots.map((snapshot) => ({
      keyword: snapshot.keyword,
      urls: [...new Set(snapshot.urls.map(normalizeSerpUrl).filter((url): url is string => Boolean(url)))],
    })),
    minSharedUrls,
    analyzedAt,
  };
};
