import { phraseKey } from '@/services/siteFocus/terms';
import type { ReferenceTaxonomy } from './types';

export interface MergePreview {
  /** Reference pillars that match a manual pillar by folded term key: kept under the manual label. */
  matched: Array<{ manual: string; pillarId: string; subtopics: number }>;
  /** Reference pillars with no manual counterpart: would be added. */
  added: Array<{ pillarId: string; label: string; subtopics: number }>;
  /** Manual pillars no reference pillar matches: kept untouched. */
  manualOnly: string[];
}

/** Read-only preview of merging a reference taxonomy into hand-made pillars (#57 GEM-57-06). Never mutates either side. */
export const previewTaxonomyMerge = (taxonomy: ReferenceTaxonomy, manualPillars: string[]): MergePreview => {
  const manual = manualPillars.map((label) => ({ label, key: phraseKey(label, taxonomy.language) })).filter((item) => item.key);
  const count = (id: string) => taxonomy.subtopics.filter((item) => item.pillar === id).length;
  const used = new Set<string>();
  const matched: MergePreview['matched'] = [];
  const added: MergePreview['added'] = [];
  taxonomy.pillars.forEach((pillar) => {
    const hit = manual.find((item) => item.key === pillar.id || item.key === phraseKey(pillar.label, taxonomy.language));
    if (hit) { used.add(hit.label); matched.push({ manual: hit.label, pillarId: pillar.id, subtopics: count(pillar.id) }); }
    else added.push({ pillarId: pillar.id, label: pillar.label, subtopics: count(pillar.id) });
  });
  return { matched, added, manualOnly: manualPillars.filter((label) => !used.has(label)) };
};
