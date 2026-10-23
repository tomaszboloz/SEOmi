import i18n from '@/i18n';
import type { BriefRecommendationInput } from './briefInput';

export const BLOCK_START = '<!-- seomi-exec-card:start -->';
export const BLOCK_END = '<!-- seomi-exec-card:end -->';

const section = (key: string, lines: string[]): string[] =>
  lines.length ? [`## ${i18n.t(`executionCard.brief.${key}`)}`, ...lines, ''] : [];

/** Managed markdown block; replaced in place on every update so repeated clicks never duplicate it. */
export const buildBriefBlock = (input: BriefRecommendationInput): string => {
  const links = input.links;
  const linkLines = links ? [
    ...(links.targetPillarUrl ? [`- ${i18n.t('executionCard.brief.pillar')}: ${links.targetPillarUrl}${links.anchors?.length ? ` (${i18n.t('executionCard.brief.anchors')}: ${links.anchors.join(', ')})` : ''}`] : []),
    ...links.donorUrls.map((url) => `- ${i18n.t('executionCard.brief.donor')}: ${url}`),
  ] : [];
  const body = [
    ...section('entities', (input.missingEntities ?? []).map((entity) => `- ${entity}`)),
    ...section('links', linkLines),
    ...section('paa', (input.paaQuestions ?? []).map((question) => `- ${question}`)),
    ...section('structure', (input.h2Structure ?? []).map((heading) => `## ${heading}`)),
    ...section('jsonLd', (input.jsonLdAuthorGaps ?? []).map((gap) => `- ${gap}`)),
    ...section('footnotes', (input.footnotes ?? []).map((note) => `- ${note.attribute}: ${note.value} (${note.sourceUrl})`)),
  ];
  return [BLOCK_START, `# ${i18n.t(`executionCard.brief.origin.${input.origin}`)}: ${input.sourceUrl}`, '', ...body, BLOCK_END].join('\n');
};

export const upsertBlock = (draft: string, block: string): string => {
  const start = draft.indexOf(BLOCK_START);
  const end = draft.indexOf(BLOCK_END);
  if (start >= 0 && end > start) return `${draft.slice(0, start)}${block}${draft.slice(end + BLOCK_END.length)}`;
  return draft.trim() ? `${draft.trimEnd()}\n\n${block}` : block;
};
