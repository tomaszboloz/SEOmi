import { cosine } from '@/services/embeddings/vector';
import { incompatibilities } from './gate';
import type { DecayComparison, SerpSnapshot } from './types';

const key = (value: string): string => value.normalize('NFKC').trim().toLocaleLowerCase();

const only = (from: string[], other: string[]): string[] => {
  const skip = new Set(other.map(key));
  return [...new Map(from.filter((v) => !skip.has(key(v))).map((v) => [key(v), v.trim()])).values()].sort();
};

const change = (from: string | null, to: string | null) => (from && to && from !== to ? { from, to } : null);

export const compareSnapshots = (base: SerpSnapshot, current: SerpSnapshot): DecayComparison => {
  const incompatible = incompatibilities(base, current);
  const none = { centroidShift: null, newEntities: [], lostEntities: [], intentChange: null, formatChange: null, addedUrls: [], removedUrls: [] };
  if (incompatible.length) return { status: 'incompatible', incompatible, ...none };
  if (!base.centroid || !current.centroid || !base.docs.length || !current.docs.length) return { status: 'unavailable', incompatible, ...none };
  const before = base.docs.map((d) => d.url);
  const after = current.docs.map((d) => d.url);
  return {
    status: 'ready', incompatible,
    centroidShift: Math.max(0, 1 - cosine(base.centroid, current.centroid)),
    newEntities: only(current.consensusEntities, base.consensusEntities),
    lostEntities: only(base.consensusEntities, current.consensusEntities),
    intentChange: change(base.dominantIntent, current.dominantIntent),
    formatChange: change(base.dominantFormat, current.dominantFormat),
    addedUrls: only(after, before), removedUrls: only(before, after),
  };
};
