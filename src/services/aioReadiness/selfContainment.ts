import type { LanguageRules } from './languageRules';
import { contentWords, mentions, sentenceSpans, startsWithAny } from './text';
import type { SelfContainmentDetails } from './types';

const DEICTIC_FALLBACK = ['here', 'there', 'now', 'today', 'above', 'below', 'as follows'];

export interface SelfContainmentInput { text: string; heading?: string; coreTerms?: string[]; }

const spanOf = (text: string, needle: string, start = 0) => {
  const offset = text.toLowerCase().indexOf(needle.toLowerCase(), start);
  return offset < 0 ? undefined : { start: offset, end: offset + needle.length };
};

const markerPattern = (marker: string, charBased: boolean): RegExp =>
  charBased ? new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u') :
    new RegExp(`(?:^|[^\\p{L}\\p{N}])${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu');

export const selfContainmentOf = (input: SelfContainmentInput, rules: LanguageRules): SelfContainmentDetails => {
  const sentences = sentenceSpans(input.text);
  const anchors = input.coreTerms?.length ? input.coreTerms : contentWords(input.heading ?? '', rules.charBased);
  const first = sentences.slice(0, 2);
  let dangling = 0;
  let deictic = 0;
  const spans: SelfContainmentDetails['spans'] = [];
  first.forEach((sentence, index) => {
    if (startsWithAny(sentence.text, rules.dangling, rules.charBased)) {
      const earlier = sentences.slice(0, index).map((item) => item.text).join(' ');
      const antecedent = anchors.some((word) => mentions(sentence.text, word, rules.charBased)) ||
        (Boolean(earlier) && contentWords(earlier, rules.charBased)
          .some((word) => mentions(sentence.text, word, rules.charBased)));
      if (!antecedent) {
        dangling += 1;
        spans.push({ kind: 'dangling', start: sentence.start, end: sentence.end });
      }
    }
    [...new Set([...(rules.deictic ?? []), ...DEICTIC_FALLBACK])].forEach((marker) => {
      if (!markerPattern(marker, Boolean(rules.charBased)).test(sentence.text)) return;
      deictic += 1;
      const span = spanOf(input.text, marker, sentence.start);
      if (span) spans.push({ kind: 'deictic', ...span });
    });
  });
  const terms = input.coreTerms?.length ? input.coreTerms : contentWords(input.heading ?? '', rules.charBased);
  const anchorStatus = terms.length ? 'known' : 'unknown';
  const noEntity = terms.length > 0 && !terms.some((term) => mentions(input.text, term, rules.charBased));
  if (noEntity) spans.push({ kind: 'no-entity', start: 0, end: input.text.length });
  const score = Math.max(0, 1 - (0.35 * dangling + 0.4 * deictic + 0.5 * Number(noEntity)));
  return { score, dangling, deictic, noEntity, anchorStatus, reasons: [
    ...(dangling ? ['dangling pronoun lacks an in-chunk antecedent'] : []),
    ...(deictic ? ['deictic marker depends on external context'] : []),
    ...(anchorStatus === 'unknown' ? ['core or pillar anchor was not supplied'] : []),
    ...(noEntity ? ['core or pillar term is absent from the chunk'] : []),
  ], spans };
};
