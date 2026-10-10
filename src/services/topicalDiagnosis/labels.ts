import { normalizeSemanticText, semanticPageLanguage, semanticPageTermEntries } from '@/services/semanticText';
import type { DiagnosisDocument } from './types';
import { topicalTerms, type TermStatistics } from './similarity';
import { LABEL_MAX_TOKENS, LABEL_MIN_COVERAGE_SHARE, MIN_DOCUMENTS_FOR_CEILING, SITE_WIDE_TERM_SHARE } from './thresholds';

export interface TopicLabel {
  label: string;
  source: 'title' | 'content' | 'none';
}

const coverageOf = (members: DiagnosisDocument[], termsOf: (document: DiagnosisDocument) => Iterable<string>) => {
  const coverage = new Map<string, number>();
  members.forEach((document) => { for (const key of termsOf(document)) coverage.set(key, (coverage.get(key) ?? 0) + 1); });
  return coverage;
};

const minimumCoverage = (members: DiagnosisDocument[]): number =>
  members.length > 1 ? Math.max(2, Math.ceil(members.length * LABEL_MIN_COVERAGE_SHARE)) : 1;

/** Keeps the first form of each word so the Polish and English title of one document count once. */
const dedupeForms = (forms: string[]): string[] => {
  const seen = new Set<string>();
  return forms.filter((form) => {
    const folded = normalizeSemanticText(form);
    if (seen.has(folded)) return false;
    seen.add(folded);
    return true;
  });
};

/** The most common observed surface form of a content term across the members. */
const surfaceForms = (members: DiagnosisDocument[]): Map<string, string> => {
  const counts = new Map<string, Map<string, number>>();
  members.forEach((document) => document.pages.forEach((page) => semanticPageTermEntries(page).forEach(({ key, surface }) => {
    const forms = counts.get(key) ?? new Map<string, number>();
    forms.set(surface, (forms.get(surface) ?? 0) + 1);
    counts.set(key, forms);
  })));
  return new Map([...counts].map(([key, forms]) => [key, [...forms].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1))[0][0]]));
};

/**
 * Title tokens shared by the members, scored by coverage and rarity across all
 * titles, in the order of the first member's title. Content terms are the
 * fallback; they tend to pick boilerplate of the main column.
 */
export const topicLabel = (members: DiagnosisDocument[], allDocuments: DiagnosisDocument[], stats: TermStatistics): TopicLabel => {
  const minimum = minimumCoverage(members);
  const titleFrequency = coverageOf(allDocuments, (document) => document.titleTerms);
  const total = Math.max(1, allDocuments.length);
  const titleCoverage = coverageOf(members, (document) => document.titleTerms);
  const titleOrder = [...members[0]?.titleTerms ?? []];
  const titleScore = (key: string) => (titleCoverage.get(key)! / members.length) * Math.log(1 + total / (titleFrequency.get(key) ?? 1));
  // A token in most titles ("linkedin" on a LinkedIn blog) names the site; it labels a topic only when nothing else does.
  const siteWide = (key: string) => allDocuments.length >= MIN_DOCUMENTS_FOR_CEILING && (titleFrequency.get(key) ?? 0) / total > SITE_WIDE_TERM_SHARE;
  const covered = [...titleCoverage.entries()].filter(([, count]) => count >= minimum).map(([key]) => key)
    .sort((a, b) => titleScore(b) - titleScore(a) || titleOrder.indexOf(a) - titleOrder.indexOf(b) || a.localeCompare(b));
  // Prefer the language of the members' primary pages, so a bilingual topic gets a single-language label.
  const primaryLanguage = `${semanticPageLanguage(members[0]?.primaryPage ?? {}) ?? 'und'}:`;
  const pick = (keys: string[]) => {
    const own = keys.filter((key) => key.startsWith(primaryLanguage));
    return own.length >= 2 ? own : [...own, ...keys.filter((key) => !key.startsWith(primaryLanguage))];
  };
  const specific = covered.filter((key) => !siteWide(key));
  const displayForm = (key: string) => members.map((document) => document.titleForms.get(key)).find(Boolean) ?? key;
  const titleLabel = dedupeForms(pick(specific.length ? specific : covered).map(displayForm)).slice(0, LABEL_MAX_TOKENS);
  if (titleLabel.length) return { label: titleLabel.join(' '), source: 'title' };

  const contentCoverage = coverageOf(members, (document) => topicalTerms(document, stats));
  const contentKeys = [...contentCoverage.entries()].filter(([, count]) => count >= minimum).map(([key]) => key)
    .sort((a, b) => contentCoverage.get(b)! * stats.idf(b) - contentCoverage.get(a)! * stats.idf(a) || a.localeCompare(b));
  const forms = surfaceForms(members);
  const contentLabel = dedupeForms(contentKeys.map((key) => forms.get(key) ?? key.slice(key.indexOf(':') + 1))).slice(0, 2);
  if (contentLabel.length) return { label: contentLabel.join(' / '), source: 'content' };
  return { label: '', source: 'none' };
};
