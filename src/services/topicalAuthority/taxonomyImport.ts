import { createTopicalNode, type TopicalMapDocument } from '@/services/topicalMap';
import type { MergePreview } from './taxonomyMerge';
import type { ReferenceTaxonomy } from './types';

const MAX_NODES = 300;
const MAX_TERMS = 80;

/**
 * Adds the reference pillars from a merge preview as planned pillar nodes (#57 GEM-57-06). Existing nodes,
 * including every hand-made pillar, are never edited or removed; a pillar whose title already exists is skipped.
 */
export const importPreviewPillars = (document: TopicalMapDocument, preview: MergePreview, taxonomy: ReferenceTaxonomy): TopicalMapDocument => {
  const titles = new Set(document.nodes.map((node) => node.title.trim().toLowerCase()));
  const room = Math.max(0, MAX_NODES - document.nodes.length);
  const created = preview.added.filter((item) => !titles.has(item.label.trim().toLowerCase())).slice(0, room).map((item) => ({
    ...createTopicalNode(item.label),
    kind: 'pillar' as const,
    evidenceTerms: taxonomy.subtopics.filter((sub) => sub.pillar === item.pillarId).map((sub) => sub.label).slice(0, MAX_TERMS),
  }));
  return { ...document, nodes: [...document.nodes, ...created] };
};
