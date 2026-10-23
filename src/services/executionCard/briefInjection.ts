import { createTopicalNode } from '@/services/topicalMap';
import type { TopicalEntityFact, TopicalMapDocument, TopicalNode } from '@/services/topicalDocument/types';
import { MAX_BRIEF_ENTITIES, MAX_BRIEF_LINKS, MAX_FACTS, MAX_NODES, cleanText, id, validHttpUrl } from '@/services/topicalDocument/primitives';
import { buildBriefBlock, upsertBlock } from './briefBlock';
import type { BriefRecommendationInput } from './briefInput';

export interface BriefInjectionResult {
  document: TopicalMapDocument;
  nodeId: string | null;
  created: boolean;
}

const sameTitle = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
const union = (a: string[], b: string[], limit: number) => [...new Set([...a, ...b])].slice(0, limit);
const clean = (values: string[] | undefined, limit: number) => (values ?? []).map((value) => cleanText(value, 120)).filter(Boolean).slice(0, limit);

/** One brief per page URL (fallback: same title): a repeated click updates it instead of creating another. */
const findNode = (nodes: TopicalNode[], input: BriefRecommendationInput): TopicalNode | undefined =>
  nodes.find((node) => node.sourceUrls.includes(input.sourceUrl)) ?? nodes.find((node) => sameTitle(node.title, input.title));

const linkTargets = (input: BriefRecommendationInput): string[] => {
  const links = input.links;
  return links ? [links.targetPillarUrl, ...links.donorUrls].map(validHttpUrl).filter((url): url is string => Boolean(url)) : [];
};

const factsFor = (input: BriefRecommendationInput, existing: TopicalEntityFact[]): TopicalEntityFact[] => {
  const seen = new Set(existing.map((fact) => `${fact.attribute}|${fact.sourceUrl}`));
  return (input.footnotes ?? []).flatMap((note) => {
    const sourceUrl = validHttpUrl(note.sourceUrl);
    const key = `${note.attribute}|${sourceUrl}`;
    if (!sourceUrl || !cleanText(note.attribute, 120) || !cleanText(note.value, 500) || seen.has(key)) return [];
    seen.add(key);
    return [{ id: id(), attribute: cleanText(note.attribute, 120), value: cleanText(note.value, 500), sourceUrl, reuseStatus: 'locked' as const }];
  });
};

/** Creates or updates the brief for a recommendation. Pure: the caller persists the returned document. */
export const applyRecommendationToBrief = (document: TopicalMapDocument, input: BriefRecommendationInput): BriefInjectionResult => {
  const existing = findNode(document.nodes, input);
  if (!existing && document.nodes.length >= MAX_NODES) return { document, nodeId: null, created: false };
  const node = existing ?? { ...createTopicalNode(cleanText(input.title, 180)), sourceUrls: [input.sourceUrl] };
  const brief = node.contentBrief;
  const updated: TopicalNode = {
    ...node,
    lifecycle: node.lifecycle === 'planned' ? 'briefed' : node.lifecycle,
    sourceUrls: union(node.sourceUrls, [input.sourceUrl], 1000),
    facts: [...node.facts, ...factsFor(input, node.facts)].slice(0, MAX_FACTS),
    contentBrief: {
      ...brief,
      requiredEntities: union(brief.requiredEntities, clean(input.missingEntities, MAX_BRIEF_ENTITIES), MAX_BRIEF_ENTITIES),
      internalLinkTargets: union(brief.internalLinkTargets, linkTargets(input), MAX_BRIEF_LINKS),
      draftMarkdown: upsertBlock(brief.draftMarkdown, buildBriefBlock(input)).slice(0, 50_000),
    },
  };
  const nodes = existing ? document.nodes.map((item) => (item.id === node.id ? updated : item)) : [...document.nodes, updated];
  return { document: { ...document, nodes }, nodeId: updated.id, created: !existing };
};
