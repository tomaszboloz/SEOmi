import { rulesFor } from '@/services/aioReadiness/languageRules';
import { countTerm } from '@/services/linkInjector/section';
import { simulateImprovement, type PageFocus, type SiteFocusReport } from '@/services/siteFocus';
import { IMPROVED_BORDERLINE_TRS } from '@/services/siteFocus/recommend';
import type { CrawledPageSummary } from '@/types';
import { semanticSections, type SemanticSection } from './sections';

const MAX_CORE_TERMS = 8;
const MAX_MISSING = 3;

export interface SectionSignal { index: number; heading: string; level: number; coreHits: number; foreignTerms: string[]; foreignHits: number }

export interface SurgicalPrescription {
  status: 'ready' | 'no-sections' | 'nothing-to-fix';
  url: string;
  /** Section the entity-rich heading and Answer-First paragraph go into. */
  target: (SectionSignal & { position: number; before: { heading: string; paragraph: string; firstSentence: string } }) | null;
  /** Core Topic terms absent from the whole page (max 3), the entities the new paragraph must cover. */
  missingTerms: string[];
  /** Entity for the heading: first missing term, else the strongest Core term. */
  headingEntity: string | null;
  /** The target's first sentence opens with a pronoun pointing back (not self-contained). */
  danglingOpener: string | null;
  /** Sections dominated by off-topic terms: candidates to remove or rewrite (semantic drift). */
  drift: SectionSignal[];
  /** Site SFS if this page reached the improvement target, from the SFS engine; null when not applicable. */
  forecast: { currentSfs: number; projectedSfs: number; delta: number } | null;
}

const signal = (section: SemanticSection, core: string[], foreign: string[]): SectionSignal => {
  const text = [section.heading, ...section.paragraphs].join('\n');
  const foreignCounts = foreign.map((term) => [term, countTerm(text, term)] as const).filter(([, count]) => count > 0);
  return {
    index: section.index, heading: section.heading, level: section.level,
    coreHits: core.reduce((sum, term) => sum + countTerm(text, term), 0),
    foreignTerms: foreignCounts.map(([term]) => term),
    foreignHits: foreignCounts.reduce((sum, [, count]) => sum + count, 0),
  };
};

const danglingOpener = (sentence: string, language: string): string | null => {
  const lower = sentence.toLocaleLowerCase().trim();
  const openers = [...rulesFor(language).rules.dangling].sort((a, b) => b.length - a.length);
  return openers.find((opener) => lower.startsWith(opener) && !/[\p{L}\p{N}]/u.test(lower.charAt(opener.length))) ?? null;
};

/**
 * Surgical page prescription (#127): "page X, under H2 «…» (section #n)". Uses only crawled sections, the
 * SFS Core Topic and the page's own off-topic terms; it never writes the replacement facts itself.
 */
export const buildSurgicalPagePrescription = (page: Pick<CrawledPageSummary, 'url' | 'rag_sections' | 'document_language'>, focus: PageFocus, report: SiteFocusReport): SurgicalPrescription => {
  const sections = semanticSections(page).filter((section) => section.level === 2 || section.level === 3);
  const base = { url: focus.url, target: null, missingTerms: [], headingEntity: null, danglingOpener: null, drift: [], forecast: null };
  if (!sections.length) return { status: 'no-sections', ...base };
  const core = [...report.coreTopic.terms].sort((a, b) => b.weight - a.weight).slice(0, MAX_CORE_TERMS).map((item) => item.term);
  const foreign = focus.offTopicKeywords.map((item) => item.term);
  const allText = semanticSections(page).flatMap((section) => [section.heading, ...section.paragraphs]).join('\n');
  const missingTerms = core.filter((term) => countTerm(allText, term) === 0).slice(0, MAX_MISSING);
  const signals = sections.map((section) => signal(section, core, foreign));
  const drift = signals.filter((item) => item.foreignHits > 0 && item.foreignHits > item.coreHits);
  const h2 = signals.filter((item) => item.level === 2);
  const pool = (h2.length ? h2 : signals).filter((item) => !drift.includes(item));
  const weakest = pool.reduce<SectionSignal | null>((best, item) => (!best || item.coreHits < best.coreHits ? item : best), null);
  if (!weakest || (!missingTerms.length && !drift.length && weakest.coreHits > 0)) return { status: 'nothing-to-fix', ...base, drift };
  const section = sections.find((item) => item.index === weakest.index)!;
  const opener = danglingOpener(section.firstSentence, page.document_language || report.model.language || 'en');
  const eligible = !focus.skipped && focus.type !== 'technical' && focus.trs < IMPROVED_BORDERLINE_TRS;
  const projected = eligible ? simulateImprovement(report.pages, [focus.url]) : null;
  return {
    status: 'ready',
    url: focus.url,
    target: { ...weakest, position: section.index + 1, before: { heading: section.heading, paragraph: section.paragraphs[0] ?? '', firstSentence: section.firstSentence } },
    missingTerms,
    headingEntity: missingTerms[0] ?? core[0] ?? null,
    danglingOpener: opener,
    drift,
    forecast: projected === null ? null : { currentSfs: report.score, projectedSfs: projected, delta: Math.round((projected - report.score) * 10) / 10 },
  };
};
