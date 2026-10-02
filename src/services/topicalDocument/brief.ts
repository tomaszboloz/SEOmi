import type { ContentBriefVersion, TopicalContentBrief } from './types';
import { cleanText, id, oneOf, validHttpUrl, MAX_BRIEF_ENTITIES, MAX_BRIEF_LINKS, MAX_BRIEF_VERSIONS } from './primitives';
import { createEmptyContentBrief } from './factories';
export const normalizeContentBriefVersion = (raw: unknown): ContentBriefVersion | null => {
  if (!raw || typeof raw !== 'object') return null;
  const version = raw as Record<string, unknown>;
  const draftMarkdown = cleanText(version.draftMarkdown, 50_000);
  if (!draftMarkdown) return null;
  const savedAt = cleanText(version.savedAt, 40);
  return {
    id: cleanText(version.id, 100) || id(),
    savedAt: savedAt || new Date(0).toISOString(),
    note: cleanText(version.note, 240),
    draftMarkdown,
  };
};

export const normalizeContentBrief = (raw: unknown): TopicalContentBrief => {
  if (!raw || typeof raw !== 'object') return createEmptyContentBrief();
  const brief = raw as Record<string, unknown>;
  const requiredEntities = Array.isArray(brief.requiredEntities)
    ? [...new Set(brief.requiredEntities.map((entity) => cleanText(entity, 120)).filter(Boolean))].slice(0, MAX_BRIEF_ENTITIES)
    : [];
  const internalLinkTargets = Array.isArray(brief.internalLinkTargets)
    ? [...new Set(brief.internalLinkTargets.map(validHttpUrl).filter((url): url is string => Boolean(url)))].slice(0, MAX_BRIEF_LINKS)
    : [];
  const paragraphReviews = Array.isArray(brief.paragraphReviews) ? brief.paragraphReviews.slice(0, 500).flatMap((rawReview) => {
    if (!rawReview || typeof rawReview !== 'object') return [];
    const review = rawReview as Record<string, unknown>;
    const paragraph = cleanText(review.paragraph, 50_000);
    if (!paragraph) return [];
    const treatment = oneOf(review.treatment, ['unreviewed', 'editorial', 'source-backed'] as const, 'unreviewed');
    const sourceUrl = validHttpUrl(review.sourceUrl) ?? '';
    return [{ paragraph, treatment, sourceUrl, sourceChecked: treatment === 'source-backed' && Boolean(sourceUrl) && review.sourceChecked === true }];
  }) : [];
  const draftVersions = Array.isArray(brief.draftVersions)
    ? brief.draftVersions.slice(0, MAX_BRIEF_VERSIONS).flatMap((rawVersion) => {
      const version = normalizeContentBriefVersion(rawVersion);
      return version ? [version] : [];
    })
    : [];
  return {
    targetQueryId: cleanText(brief.targetQueryId, 100),
    requiredEntities,
    snippetTarget: oneOf(brief.snippetTarget, ['none', 'definition', 'list', 'table', 'steps', 'faq'] as const, 'none'),
    internalLinkTargets,
    draftMarkdown: cleanText(brief.draftMarkdown, 50_000),
    paragraphReviews,
    draftVersions,
  };
};
