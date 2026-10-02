import { assessContentBrief, extractDraftParagraphs, verifiedFactsForReuse } from '@/services/contentBrief';
import { normalizeUrl } from './primitives';
import type { BriefEditorProps } from './types';

export const createBriefModel = ({ node, facts, pages, onUpdate, onAdvance }: BriefEditorProps) => {
  const brief = node.contentBrief;
  const assessment = assessContentBrief(node, brief, facts, pages);
  const reusableFacts = verifiedFactsForReuse(facts);
  const crawledUrls = new Set(pages.flatMap((page) => [page.url, page.final_url]).map(normalizeUrl).filter(Boolean));
  const unverifiedPlanTargets = [...new Set(node.sourceUrls.map(normalizeUrl).filter((url) => url && !crawledUrls.has(url)))];
  const paragraphs = extractDraftParagraphs(brief.draftMarkdown);
  const update = (patch: Partial<typeof brief>) => onUpdate({ ...brief, ...patch });
  return { node, facts, pages, brief, assessment, reusableFacts, crawledUrls, unverifiedPlanTargets, paragraphs, update, onUpdate, onAdvance };
};

export type BriefModel = ReturnType<typeof createBriefModel>;
