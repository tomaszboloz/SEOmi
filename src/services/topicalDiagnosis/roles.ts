import type { DiagnosisDocument } from './types';
import type { DocumentLinkIndex } from './links';
import { HUB_MAX_WORDS_PER_LINK, HUB_MIN_LINKED_DOCUMENTS, UTILITY_PATH_PATTERN } from './thresholds';

const pathname = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/**
 * A hub is a listing: it is paginated, or it links from its main content to
 * many documents of its own section with little text per link. Utility pages
 * (contact, legal, press) are neither topics nor hubs.
 */
export const assignRoles = (documents: DiagnosisDocument[], links: DocumentLinkIndex): DiagnosisDocument[] => {
  const sectionById = new Map(documents.map((document) => [document.id, document.section]));
  return documents.map((document) => {
    const paginated = document.pages.some((page) => Boolean(page.pagination_next || page.pagination_prev));
    const sameSectionTargets = [...(links.outgoing.get(document.id) ?? [])]
      .filter((target) => sectionById.get(target) === document.section).length;
    const words = document.pages.reduce((sum, page) => sum + (page.word_count ?? 0), 0);
    const listing = sameSectionTargets >= HUB_MIN_LINKED_DOCUMENTS && words / sameSectionTargets < HUB_MAX_WORDS_PER_LINK;
    const role = paginated || listing ? 'hub' : UTILITY_PATH_PATTERN.test(pathname(document.primaryPage.url)) ? 'utility' : 'content';
    return { ...document, role };
  });
};
