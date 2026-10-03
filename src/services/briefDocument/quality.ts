import type { DraftQualityAssessment } from './types';
import { briefText } from './primitives';
import { stripFrontMatter, scoreWords, scoreSections } from './markdown';

const FILLER_PHRASES = [
  'at the end of the day', 'when it comes to', 'in general', 'generally speaking', 'a variety of', 'a wide range of',
  'it is important', 'it is crucial', 'plays a vital role', 'leverage', 'utilize', 'seamless', 'robust', 'cutting-edge',
  'game changer', 'in today\'s world', 'na koniec dnia', 'ogólnie rzecz biorąc', 'jeśli chodzi o', 'szeroki zakres',
  'odgrywa kluczową rolę', 'jest kluczowe', 'jest ważne', 'jest istotne', 'wykorzystaj potencjał', 'nowoczesne rozwiązanie',
  'innowacyjne rozwiązanie', 'kompleksowe rozwiązanie', 'w dzisiejszym świecie', 'warto zauważyć', 'należy pamiętać',
];
const EXAMPLE_MARKERS = ['for example', 'for instance', 'e.g.', 'such as', 'in practice', 'consider ', 'na przykład', 'np.', 'w praktyce', 'rozważmy', 'przykładowo'];
const STOP_CAPS = new Set(['The', 'This', 'That', 'These', 'Those', 'How', 'What', 'Why', 'When', 'Where', 'Who', 'Which', 'This', 'Jest', 'To', 'Ten', 'Ta', 'Tego', 'Jak', 'Co', 'Dlaczego', 'Kiedy', 'Gdzie', 'Który', 'Która', 'Warto', 'Każdy', 'Każda', 'Dzięki', 'Jeśli', 'Można', 'Należy', 'Przykład']);
/**
 * Mechanical editorial signals adapted from the upstream quality workflow.
 * This is advisory only: specificity is not fact-checking and the score is not a ranking metric.
 */
export const assessDraftQuality = (markdown: string, referenceWordFloor = 800): DraftQualityAssessment => {
  const body = stripFrontMatter(markdown);
  const clean = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ');
  const wordCount = scoreWords(clean);
  const sections = scoreSections(body);
  const sectionWordCounts = (sections.length ? sections : [{ heading: '', body }]).map((section) => scoreWords(section.body.replace(/```[\s\S]*?```/g, ' ').replace(/^\s*\|.*\|\s*$/gm, ' ')));
  const sortedCounts = [...sectionWordCounts].sort((left, right) => left - right);
  const middle = Math.floor(sortedCounts.length / 2);
  const medianWordsPerSection = sortedCounts.length % 2 ? sortedCounts[middle] : Math.round((sortedCounts[middle - 1] + sortedCounts[middle]) / 2);
  const depth = Math.round(25 * Math.min(1, medianWordsPerSection / 90));
  const sectionsWithExamples = sections.filter((section) => EXAMPLE_MARKERS.some((marker) => section.body.toLocaleLowerCase().includes(marker))).length;
  const examples = Math.round(20 * Math.min(1, (sections.length ? sectionsWithExamples / sections.length : 0) / 0.6));
  const namedTerms = (clean.match(/\b[\p{Lu}][\p{L}\p{N}.-]{2,}\b/gu) ?? []).filter((word) => !STOP_CAPS.has(word)).length;
  const numbers = (clean.match(/(?<![\p{L}\p{N}$])\$?\d[\d,.]*(?:\s?%|\s?(?:zł|PLN|EUR|USD))?/gu) ?? []).length;
  const citations = (body.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  const concreteDetailsPerHundred = (namedTerms + numbers + citations) / Math.max(wordCount, 1) * 100;
  const specificity = Math.round(20 * Math.min(1, concreteDetailsPerHundred / 3));
  const lower = clean.toLocaleLowerCase();
  const fillerMatches = FILLER_PHRASES.filter((phrase) => lower.includes(phrase));
  const fillerOccurrences = FILLER_PHRASES.reduce((total, phrase) => total + (lower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 0);
  const fillerDensity = fillerOccurrences / Math.max(wordCount, 1) * 100;
  const antiFiller = Math.round(20 * Math.max(0, 1 - fillerDensity / 1.2));
  const safeFloor = Number.isFinite(referenceWordFloor) ? Math.min(10_000, Math.max(1, Math.floor(referenceWordFloor))) : 800;
  const length = Math.round(15 * Math.min(1, wordCount / safeFloor));
  const score = depth + examples + specificity + antiFiller + length;
  const recommendations: string[] = [];
  if (medianWordsPerSection < 90) recommendations.push(briefText('expandSections', { median: medianWordsPerSection }));
  if (sections.length && sectionsWithExamples / sections.length < 0.6) recommendations.push(briefText('examples', { withExamples: sectionsWithExamples, total: sections.length }));
  if (concreteDetailsPerHundred < 3) recommendations.push(briefText('specificity'));
  if (fillerDensity > 0.4) recommendations.push(briefText('filler', { matches: fillerMatches.slice(0, 5).join(', ') }));
  if (wordCount < safeFloor) recommendations.push(briefText('wordFloor', { count: wordCount, floor: safeFloor }));
  return {
    score,
    grade: score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'needs-work' : 'thin',
    components: { depth, examples, specificity, antiFiller, length },
    wordCount, sectionCount: sections.length, medianWordsPerSection, fillerMatches, recommendations,
    methodology: briefText('editorialMethodology', { floor: safeFloor }),
  };
};
