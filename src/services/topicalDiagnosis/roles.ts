import type { CrawledPageSummary } from '@/types';
import { normalizeGraphUrl } from '@/services/semanticGraph/urls';
import type { DiagnosisDocument } from './types';
import { isPaginationPage } from './pagination';
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
export const assignRoles = (documents: DiagnosisDocument[]): DiagnosisDocument[] => {
  const documentByUrl = new Map<string, DiagnosisDocument>();
  documents.forEach((document) => document.urls.forEach((url) => documentByUrl.set(url, document)));
  // Each language version is judged on its own: a bilingual document doubles the words, not the targets.
  const isListingPage = (page: CrawledPageSummary, document: DiagnosisDocument): boolean => {
    const targets = new Set<string>();
    (page.semantic_links ?? []).filter((link) => link.is_internal).forEach((link) => {
      const target = documentByUrl.get(normalizeGraphUrl(link.target_url, page.final_url || page.url));
      if (target && target !== document && target.section === document.section) targets.add(target.id);
    });
    // Legacy snapshots without a word count cannot prove a listing.
    if (typeof page.word_count !== 'number') return false;
    return targets.size >= HUB_MIN_LINKED_DOCUMENTS && page.word_count / targets.size < HUB_MAX_WORDS_PER_LINK;
  };
  return documents.map((document) => {
    const paginated = document.pages.some(isPaginationPage);
    const listing = document.pages.some((page) => isListingPage(page, document));
    const role = paginated || listing ? 'hub' : UTILITY_PATH_PATTERN.test(pathname(document.primaryPage.url)) ? 'utility' : 'content';
    return { ...document, role };
  });
};
