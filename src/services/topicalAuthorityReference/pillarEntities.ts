import type { RefPillar, ReferenceTaxonomy } from '@/services/topicalAuthority';
import type { WikidataLookup } from '@/services/entityIds';

export type PillarLookup = (label: string, language: string) => Promise<WikidataLookup>;
export interface PillarLinkResult { taxonomy: ReferenceTaxonomy; linked: number; review: number; failed: number }

const MAX_PILLARS = 12;
const same = (left: string, right: string): boolean => left.normalize('NFKC').trim().toLocaleLowerCase() === right.normalize('NFKC').trim().toLocaleLowerCase();

/**
 * Optional Knowledge Graph source (#57): links each reference pillar to a Wikidata item through the native public feed.
 * An exact label match is `exact`; any other first search hit is `search` and needs human review. A failed lookup
 * leaves the pillar untouched and is counted, never read as "no entity". Pure apart from the injected lookup.
 */
export const linkPillarEntities = async (taxonomy: ReferenceTaxonomy, lookup: PillarLookup, signal?: AbortSignal): Promise<PillarLinkResult> => {
  const result = { linked: 0, review: 0, failed: 0 };
  const pillars: RefPillar[] = [];
  for (const [index, pillar] of taxonomy.pillars.entries()) {
    if (index >= MAX_PILLARS || signal?.aborted) { pillars.push(pillar); continue; }
    const found = await lookup(pillar.label, taxonomy.language);
    if (found.status !== 'ok') { result.failed += 1; pillars.push(pillar); continue; }
    const exact = found.candidates.find((item) => same(item.label, pillar.label));
    const hit = exact ?? found.candidates[0];
    if (!hit) { pillars.push(pillar); continue; }
    result.linked += 1;
    if (!exact) result.review += 1;
    pillars.push({ ...pillar, entityId: hit.id, entityMatch: exact ? 'exact' : 'search' });
  }
  return { taxonomy: { ...taxonomy, pillars }, ...result };
};
