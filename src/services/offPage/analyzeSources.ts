import type { BacklinkProfileData } from '@/types';
import { brandAliases, selectSources, type SourceAnalysis, type SourceEvidence } from './sources';
import type { AliasSense } from './aliasSense';
import { fetchSource } from './sourceTransport';
import { embedSources, type SourceEmbeddingSettings } from './sourceEmbeddings';

export const analyzeSources = async (
  profile: BacklinkProfileData, name: string | undefined, coreText: string, coreEntity: string,
  settings: SourceEmbeddingSettings, signal: AbortSignal, update: (sources: SourceEvidence[]) => void, domain = profile.domain,
  senses: AliasSense[] = [],
): Promise<SourceAnalysis> => {
  signal.throwIfAborted();
  const sources = selectSources(profile);
  update([...sources]);
  let next = 0;
  const worker = async () => {
    while (next < sources.length) {
      signal.throwIfAborted();
      const index = next++;
      sources[index] = await fetchSource(sources[index], signal);
      signal.throwIfAborted();
      update([...sources]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, sources.length) }, worker));
  return embedSources({ sources, topic: null, coreEntity, aliases: brandAliases(domain, name), ...(senses.length ? { senses } : {}) }, coreText, settings, signal);
};
