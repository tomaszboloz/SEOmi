import type { KeywordClusteringResult } from '@/services/keywordClustering';

export interface ClusteringSession {
  input: string;
  country: string;
  language: string;
  minSharedUrls: number;
  result: KeywordClusteringResult | null;
}

export const DEFAULT_SESSION: ClusteringSession = {
  input: '',
  country: 'PL',
  language: 'pl',
  minSharedUrls: 3,
  result: null,
};

export const MAX_KEYWORDS = 50;

export const sessionKey = (projectId: string) => `seomi_keyword_clustering_${projectId}`;

export const parseKeywords = (input: string): string[] => {
  const seen = new Set<string>();
  return input
    .split(/\r?\n/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => {
      const normalized = keyword.toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};
