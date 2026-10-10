import type { CrawlRunRecord, CrawledPageSummary, SearchIntent } from '@/types';
import {
  isSemanticTopicalStatus,
  normalizeSemanticText,
  semanticPageLanguage,
  semanticPageTermEntries,
  semanticTermIdentity,
} from '@/services/semanticText';

export type SuggestionEvidenceStatus = 'no-evidence' | 'observed' | 'partial';
export type SuggestionEvidenceScope = 'title' | 'semantic-terms';
export const MAX_SUGGESTION_EVIDENCE_ITEMS = 100;
export const MAX_SUGGESTION_EVIDENCE_PAGES = 1000;
export const MAX_SUGGESTION_PAGE_MATCHES = 25;
export interface SuggestionIntentSignal { label: SearchIntent; confidence: 'uncertain'; cues: string[] }
export interface SuggestionPageEvidence { url: string; title: string | null; scopes: SuggestionEvidenceScope[]; matchedTerms: string[] }
export interface SuggestionEvidenceItem { suggestion: string; pages: SuggestionPageEvidence[]; intent: SuggestionIntentSignal }
export interface SuggestionEvidenceReport {
  status: SuggestionEvidenceStatus;
  hasRun: boolean;
  runId: string | null;
  pagesConsidered: number;
  pagesOmitted: number;
  suggestionsConsidered: number;
  suggestionsOmitted: number;
  matchesConsidered: number;
  matchesOmitted: number;
  truncated: boolean;
  partialReasons: string[];
  language: string;
  items: SuggestionEvidenceItem[];
}

export interface SuggestionEvidenceOptions { suggestions: string[]; activeProjectId: string | null; runs: CrawlRunRecord[]; language: string }
const primary = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase().split(/[-_]/u)[0];
const words = (value: string): string[] => normalizeSemanticText(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
const CUES: Array<[SearchIntent, string[]]> = [
  ['Informational', ['how', 'what', 'why', 'guide', 'tutorial', 'jak', 'co', 'dlaczego', 'poradnik', 'como', 'comment', 'come', 'wie', 'was']],
  ['Commercial', ['best', 'top', 'review', 'compare', 'vs', 'najleps', 'ranking', 'opinia', 'porown', 'vergleich', 'meilleur', 'mejores']],
  ['Transactional', ['buy', 'price', 'pricing', 'cost', 'coupon', 'discount', 'kup', 'cena', 'koszt', 'rabat', 'prix', 'precio', 'acheter', 'acquista']],
  ['Navigational', ['login', 'official', 'website', 'logowanie', 'strona', 'konto', 'kontakt', 'oficjalna']],
];

const intentSignal = (suggestion: string): SuggestionIntentSignal => {
  const suggestionWords = new Set(words(suggestion));
  const candidates = CUES.map(([label, cues]) => ({ label, cues: cues.filter((cue) => suggestionWords.has(cue)) }))
    .filter((candidate) => candidate.cues.length).sort((left, right) => right.cues.length - left.cues.length || left.label.localeCompare(right.label));
  const winner = candidates[0];
  return { label: winner?.label ?? 'Unknown', confidence: 'uncertain', cues: winner?.cues.slice(0, 4) ?? [] };
};

interface IndexedPage { url: string; title: string | null; titleWords: Set<string>; termKeys: Set<string>; language: string | null | undefined }
const indexPage = (page: CrawledPageSummary, requestedLanguage: string): IndexedPage | null => {
  if (!isSemanticTopicalStatus(page.http_status)) return null;
  const pageLanguage = primary(semanticPageLanguage(page));
  if (requestedLanguage && pageLanguage && requestedLanguage !== pageLanguage) return null;
  const language = semanticPageLanguage(page);
  return { url: page.final_url || page.url, title: page.title ?? null, titleWords: new Set(words(page.title ?? '')), termKeys: new Set(semanticPageTermEntries(page).map(({ key }) => key)), language };
};

const pageEvidence = (phraseWords: string[], page: IndexedPage): SuggestionPageEvidence | null => {
  const titleMatched = phraseWords.every((word) => page.titleWords.has(word));
  const semanticMatched = phraseWords.every((word) => page.termKeys.has(semanticTermIdentity(word, page.language)));
  const scopes: SuggestionEvidenceScope[] = [];
  if (titleMatched) scopes.push('title');
  if (semanticMatched) scopes.push('semantic-terms');
  if (!scopes.length) return null;
  return { url: page.url, title: page.title, scopes, matchedTerms: phraseWords };
};

interface RunSelection { run: CrawlRunRecord | null; invalidTimestampCount: number }
const ownedRun = (runs: CrawlRunRecord[], projectId: string | null): RunSelection => {
  if (!projectId) return { run: null, invalidTimestampCount: 0 };
  const owned = runs.filter((run) => run.projectId === projectId);
  const valid = owned.filter((run) => typeof run.id === 'string' && Boolean(run.id.trim()) && typeof run.completedAt === 'string' && Number.isFinite(Date.parse(run.completedAt)));
  return { run: [...valid].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0] ?? null, invalidTimestampCount: owned.length - valid.length };
};

export const buildSuggestionEvidence = (options: SuggestionEvidenceOptions): SuggestionEvidenceReport => {
  const selection = ownedRun(options.runs, options.activeProjectId);
  const run = selection.run;
  const language = primary(options.language);
  const allSuggestions = [...new Set(options.suggestions.map((value) => value.trim()).filter(Boolean))];
  const suggestions = allSuggestions.slice(0, MAX_SUGGESTION_EVIDENCE_ITEMS);
  const allPages = run?.result.pages ?? [];
  const pages = allPages.slice(0, MAX_SUGGESTION_EVIDENCE_PAGES);
  const indexedPages = pages.flatMap((page) => { const indexed = indexPage(page, language); return indexed ? [indexed] : []; });
  let matchesConsidered = 0;
  let matchesOmitted = 0;
  const items = suggestions.map((suggestion) => {
    const phraseWords = words(suggestion);
    const matches = phraseWords.length ? indexedPages.flatMap((page) => { const evidence = pageEvidence(phraseWords, page); return evidence ? [evidence] : []; }) : [];
    matchesConsidered += Math.min(matches.length, MAX_SUGGESTION_PAGE_MATCHES);
    matchesOmitted += Math.max(0, matches.length - MAX_SUGGESTION_PAGE_MATCHES);
    return { suggestion, pages: matches.slice(0, MAX_SUGGESTION_PAGE_MATCHES), intent: intentSignal(suggestion) };
  });
  const reportedPages = Number.isFinite(run?.result.pages_crawled) ? Math.max(run?.result.pages_crawled ?? 0, allPages.length) : allPages.length;
  const pagesOmitted = Math.max(0, reportedPages - pages.length);
  const suggestionsOmitted = allSuggestions.length - suggestions.length;
  const partialReasons = [...new Set([
    ...(selection.invalidTimestampCount ? ['invalid-run-timestamp'] : []),
    ...(run?.result.cancelled || run?.result.timed_out ? ['crawl-incomplete'] : []),
    ...(run?.result.resource_limit_reached ? ['resource-limit-reached'] : []),
    ...(run?.storage_compacted ? ['storage-compacted'] : []),
    ...(run?.result.storage_pages_truncated ? ['stored-pages-truncated'] : []),
    ...(run?.result.discovery_provenance_truncated ? ['discovery-provenance-truncated'] : []),
    ...(run?.result.pages.some((page) => page.body_truncated || page.semantic_content_partial) ? ['page-content-partial'] : []),
    ...(pagesOmitted ? ['page-bound'] : []), ...(suggestionsOmitted ? ['suggestion-bound'] : []), ...(matchesOmitted ? ['match-bound'] : []),
  ])];
  const truncated = pagesOmitted > 0 || suggestionsOmitted > 0 || matchesOmitted > 0;
  const partial = partialReasons.length > 0;
  const matched = items.some((item) => item.pages.length > 0);
  return { status: !run || !pages.length ? 'no-evidence' : partial || !matched ? partial ? 'partial' : 'no-evidence' : 'observed', hasRun: Boolean(run), runId: run?.id ?? null, pagesConsidered: pages.length, pagesOmitted, suggestionsConsidered: suggestions.length, suggestionsOmitted, matchesConsidered, matchesOmitted, truncated, partialReasons, language, items };
};
