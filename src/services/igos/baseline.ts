import { normalize } from '@/services/embeddings/vector';
import { IGOS_PROFILE } from './profile';
import type { CompetitorDoc, ConsensusBaseline } from './types';

export const entityKey = (entity: string): string => entity.normalize('NFKC').trim().toLocaleLowerCase();

/** Document frequency per entity; one document counts an entity once (aliases collapse by key). */
export const documentFrequency = (docs: CompetitorDoc[]): Map<string, { label: string; df: number }> => {
  const out = new Map<string, { label: string; df: number }>();
  docs.forEach((doc) => {
    const seen = new Map<string, string>();
    doc.entities.forEach((value) => { if (entityKey(value)) seen.set(entityKey(value), value.trim()); });
    seen.forEach((label, key) => {
      const current = out.get(key) ?? { label, df: 0 };
      current.df += 1;
      out.set(key, current);
    });
  });
  return out;
};

const centroidOf = (docs: CompetitorDoc[]) => {
  const vectors = docs.flatMap((doc) => doc.passages.map((passage) => passage.vector));
  const sum = new Float64Array(vectors[0].length);
  vectors.forEach((vector) => vector.forEach((value, index) => { sum[index] += value; }));
  return normalize(sum);
};

/** Builds the baseline only from documents that really have a body; never invents one. */
export const buildBaseline = (docs: CompetitorDoc[], requested: number): ConsensusBaseline => {
  const usable = docs.filter((doc) => doc.passages.length > 0 && (doc.status === null || (doc.status >= 200 && doc.status < 400)));
  const limitations: string[] = [];
  const base: ConsensusBaseline = { status: 'unavailable', availableDocs: usable.length, requestedDocs: requested, consensusEntities: [], rareEntities: [], centroid: null, terms: new Map(), limitations };
  if (!usable.length) { limitations.push('no-comparable-documents'); return base; }
  if (usable.length < IGOS_PROFILE.minDocs) limitations.push('too-few-documents');
  if (usable.length < requested) limitations.push('some-documents-missing');
  base.status = limitations.length ? 'partial' : 'ready';
  documentFrequency(usable).forEach(({ label, df }) => {
    const share = df / usable.length;
    if (share >= IGOS_PROFILE.consensusDf) base.consensusEntities.push(label);
    else if (share <= IGOS_PROFILE.rareDf) base.rareEntities.push(label);
  });
  base.consensusEntities.sort();
  base.rareEntities.sort();
  base.centroid = centroidOf(usable);
  usable.forEach((doc) => doc.terms.forEach((count, term) => base.terms.set(term, (base.terms.get(term) ?? 0) + count)));
  return base;
};
