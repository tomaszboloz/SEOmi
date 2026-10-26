import { embeddingClusteringResultSchema, type EmbeddingClusteringResult } from '@/services/embeddingClustering';
import { TOP10_MAX_RESULTS, type SerpSnapshot as ImportedSnapshot } from '@/services/serpImport/contracts';
import { appendSerpSnapshot } from './snapshotStore';

export const recordSerpSnapshot = (
  projectId: string | null, result: EmbeddingClusteringResult, observations: ImportedSnapshot[],
): number => {
  if (!projectId) return 0;
  const parsed = embeddingClusteringResultSchema.safeParse(result);
  if (!parsed.success || parsed.data.scoringMode !== 'embedding-serp') return 0;
  const run = parsed.data;
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const keywords = new Set([...run.clusters.flatMap((cluster) => cluster.keywords), ...run.unclusteredKeywords].map(normalize));
  let recorded = 0;
  for (const observation of observations) {
    const { source } = observation;
    if (!keywords.has(normalize(observation.keyword)) || source.availability !== 'complete' || !observation.rows.length) continue;
    const takenAt = source.capturedAt ?? source.retrievedAt ?? run.analyzedAt;
    const profile = JSON.stringify([run.scoringMode, source.kind, source.locationCode]);
    const saved = appendSerpSnapshot(projectId, {
      id: JSON.stringify([takenAt, source.provider, run.provider, run.model, profile]), takenAt,
      query: observation.keyword, country: source.countryCode ?? '', language: source.languageCode ?? '',
      provider: source.provider ?? '', model: run.model, profile, k: TOP10_MAX_RESULTS,
      centroid: null, consensusEntities: [], dominantIntent: null, dominantFormat: null,
      docs: observation.rows.map(({ url, rank }) => ({ url, rank })),
    });
    if (saved) recorded += 1;
  }
  return recorded;
};
