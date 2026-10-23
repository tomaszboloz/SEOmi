import type { PageFeatures } from './types';

const CHROME = 'nav, header, footer, aside, script, style, noscript, template, [role="navigation"], [role="banner"], [role="contentinfo"]';
const CALC = /calculat|kalkulator|rechner|calculadora|calculatrice|calcolatrice|计算|計算|계산|калькулятор/i;
const LOCAL_TEXT = /near me|opening hours|w pobliżu|godziny otwarcia|öffnungszeiten|horario de apertura|horaires d'ouverture|orari di apertura/i;
const PRICE = /(?:[$€£]|zł|pln|eur|usd)\s?\d|\d\s?(?:[$€£]|zł|pln|eur|usd)(?![\p{L}])/iu;

/** Extracts structural features from parsed HTML. Navigation, header, footer and sidebars are ignored. */
export const extractFeatures = (doc: Document): PageFeatures => {
  const root = doc.body.cloneNode(true) as HTMLElement;
  root.querySelectorAll(CHROME).forEach((node) => node.remove());
  const count = (selector: string) => root.querySelectorAll(selector).length;
  const text = root.textContent as string;
  const heads = [...root.querySelectorAll('h1, h2, h3')];
  const formInputs = count('form input:not([type="hidden"]):not([type="submit"]), form select, form textarea');
  const calculators = [...root.querySelectorAll('form, [class], [id]')].filter((el) => CALC.test(`${el.id} ${el.getAttribute('class') ?? ''}`) && el.querySelector('input, select')).length;
  const schema = root.innerHTML.match(/schema\.org\/(?:Product|Offer)\b/g)?.length ?? 0;
  const priced = [...root.querySelectorAll('[class*="product"], [class*="price"], [data-price]')].filter((el) => PRICE.test(el.textContent as string) || el.hasAttribute('data-price')).length;
  const local = count('a[href^="tel:"], iframe[src*="maps"], address') + (/schema\.org\/(?:LocalBusiness|PostalAddress)/.test(root.innerHTML) ? 1 : 0) + (LOCAL_TEXT.test(text) ? 1 : 0);
  return {
    tables: count('table'), orderedLists: count('ol'), unorderedLists: count('ul'), formInputs, calculators,
    productCards: Math.max(schema, priced), localSignals: local,
    words: (text.match(/[\p{L}\p{N}]+/gu) ?? []).length, headings: heads.length,
    headingText: heads.map((h) => h.textContent as string).join(' | '),
  };
};

export const parseFeatures = (html: string): PageFeatures => extractFeatures(new DOMParser().parseFromString(html, 'text/html'));
