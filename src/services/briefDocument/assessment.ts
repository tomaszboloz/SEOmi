import type { ContentParagraphReview, TopicalNode, TopicalContentBrief, TopicalEntityFact } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';
import type { ContentBriefAssessment } from './types';
import { normalize, normalizeHttpUrl, extractDraftParagraphs, isHttpSourceUrl } from './primitives';
import { assessDraftQuality } from './quality';
import { assessAeoReadiness } from './aeo';

export const updateParagraphReview = (
  reviews: ContentParagraphReview[],
  paragraph: string,
  patch: Partial<ContentParagraphReview>,
): ContentParagraphReview[] => {
  const current = reviews.find((review) => review.paragraph === paragraph);
  const next = { paragraph, treatment: 'unreviewed' as const, sourceUrl: '', sourceChecked: false, ...current, ...patch };
  return [...reviews.filter((review) => review.paragraph !== paragraph), next].slice(-500);
};

/**
 * Deterministic editorial gate. It catches exact locked-fact reuse but does
 * not claim to detect every factual assertion, paraphrase, or hallucination.
 */
export const assessContentBrief = (
  node: TopicalNode,
  brief: TopicalContentBrief,
  facts: TopicalEntityFact[],
  pages: CrawledPageSummary[],
): ContentBriefAssessment => {
  const targetQuery = node.queries.find((query) => query.id === brief.targetQueryId)?.text ?? null;
  const draft = normalize(brief.draftMarkdown);
  const lockedFactsInDraft = facts.filter((fact) => fact.reuseStatus !== 'verified' && normalize(fact.value).length >= 3 && draft.includes(normalize(fact.value)));
  const crawledUrls = new Set(pages.flatMap((page) => [page.url, page.final_url]).map(normalizeHttpUrl).filter(Boolean));
  const unavailableInternalLinks = brief.internalLinkTargets.filter((url) => !crawledUrls.has(normalizeHttpUrl(url)));
  const missingRequiredEntities = brief.requiredEntities.filter((entity) => !draft.includes(normalize(entity)));
  const paragraphs = extractDraftParagraphs(brief.draftMarkdown);
  const unreviewedParagraphs = paragraphs.filter((paragraph) => !brief.paragraphReviews.some((review) => review.paragraph === paragraph && review.treatment !== 'unreviewed'));
  const unsupportedParagraphs = paragraphs.filter((paragraph) => brief.paragraphReviews.some((review) => review.paragraph === paragraph
    && review.treatment === 'source-backed'
    && (!review.sourceChecked || !isHttpSourceUrl(review.sourceUrl))));
  const readyForBrief = Boolean(targetQuery && brief.snippetTarget !== 'none');
  const draftQuality = assessDraftQuality(brief.draftMarkdown);
  const assignedUrls = new Set(node.sourceUrls.map(normalizeHttpUrl).filter(Boolean));
  const schemaTypesObserved = [...new Set(pages.filter((page) => assignedUrls.has(normalizeHttpUrl(page.url)) || assignedUrls.has(normalizeHttpUrl(page.final_url))).flatMap((page) => page.schema_types ?? []))];
  const aeoReadiness = assessAeoReadiness(brief.draftMarkdown, brief.snippetTarget, schemaTypesObserved);

  return {
    targetQuery,
    missingRequiredEntities,
    lockedFactsInDraft,
    unavailableInternalLinks,
    unreviewedParagraphs,
    unsupportedParagraphs,
    wordCount: brief.draftMarkdown.trim().split(/\s+/).filter(Boolean).length,
    paragraphCount: paragraphs.length,
    draftQuality,
    aeoReadiness,
    readyForBrief,
    readyToAdvance: Boolean(readyForBrief && paragraphs.length > 0 && missingRequiredEntities.length === 0 && lockedFactsInDraft.length === 0 && unavailableInternalLinks.length === 0 && unreviewedParagraphs.length === 0 && unsupportedParagraphs.length === 0),
  };
};

export const verifiedFactsForReuse = (facts: TopicalEntityFact[]): TopicalEntityFact[] =>
  facts.filter((fact) => fact.reuseStatus === 'verified' && Boolean(fact.sourceUrl));
