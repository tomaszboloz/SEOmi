import { splitSentences } from '@/services/textSentences';

/** Splits only where punctuation is followed by space, so decimals like 2.5 stay whole. */
export const sentencesOf = (text: string): string[] =>
  splitSentences(text);

const UNITS = 'mg|mcg|µg|ug|g|kg|ml|l|iu|ie|mmol|mol|mmhg|kcal|%|pln|zł|usd|eur|gbp|\\$|€|£';
const VALUE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})(?![\\p{L}])`, 'giu');

const canon = (amount: string, unit: string): string => `${Number(amount.replace(',', '.'))}${unit.toLowerCase()}`;

/** Numbers with a medical or financial unit, e.g. "500 mg", "2,5%", "100 PLN". */
export const extractValues = (text: string): string[] =>
  [...text.matchAll(VALUE)].map((match) => canon(match[1], match[2]));
