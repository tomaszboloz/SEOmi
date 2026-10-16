import type { CoreTopic, PageFocus } from './types';

export interface RewriteBrief {
  url: string;
  coreTopic: string;
  currentTrs: number;
  targetTrs: number;
  mustInclude: string[];
  avoid: string[];
  headingSeeds: string[][];
  wordCount: { min: number; max: number };
}

const MUST_INCLUDE = 15;
const AVOID = 10;
const HEADING_GROUP = 3;
const MIN_WORDS = 600;
const TARGET_TRS = 80;

/** Structured rewrite brief for an off-topic page. It only prepares input; it never calls an AI service. */
export const buildRewriteBrief = (page: PageFocus, core: CoreTopic): RewriteBrief => {
  const have = new Set(page.keywordsFound.map((keyword) => keyword.term));
  const mustInclude = core.terms.map((term) => term.term).filter((term) => !have.has(term)).slice(0, MUST_INCLUDE);
  const headingSeeds: string[][] = [];
  for (let i = 0; i < mustInclude.length; i += HEADING_GROUP) headingSeeds.push(mustInclude.slice(i, i + HEADING_GROUP));
  const words = Math.max(MIN_WORDS, page.wordCount);
  return {
    url: page.url, coreTopic: core.label, currentTrs: page.trs, targetTrs: TARGET_TRS, mustInclude,
    avoid: page.offTopicKeywords.slice(0, AVOID).map((keyword) => keyword.term),
    headingSeeds, wordCount: { min: words, max: Math.round(words * 1.5) },
  };
};

/** Prompt text for an external AI call; written for the model, not shown as UI copy. */
export const buildBriefPrompt = (brief: RewriteBrief): string => [
  `Rewrite the page ${brief.url} so it supports the site's core topic: "${brief.coreTopic}".`,
  `Current topical relevance score: ${brief.currentTrs}/100; target: ${brief.targetTrs}/100 or higher.`,
  `Cover these core-topic terms naturally: ${brief.mustInclude.join(', ') || 'none specified'}.`,
  `Reduce or remove off-topic terms: ${brief.avoid.join(', ') || 'none'}.`,
  ...brief.headingSeeds.map((group, index) => `Heading ${index + 1} should address: ${group.join(', ')}.`),
  `Length: ${brief.wordCount.min}-${brief.wordCount.max} words. Keep facts accurate; do not invent claims.`,
].join('\n');
